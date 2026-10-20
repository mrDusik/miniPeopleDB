import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { correctBricksetNames, correctionTarget, createCorrectionScraper } from '../scripts/correct-brickset-names.js';

const silentLogger = { info() {}, warn() {} };

test('recupera un timeout transitorio de Brickset sin descartar el ID', async () => {
  let attempts = 0;
  const scraper = createCorrectionScraper({
    minIntervalMs: 0,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) throw new DOMException('This operation was aborted', 'AbortError');
      return new Response('<dl><dt>Name</dt><dd>Figure - Description</dd></dl>');
    },
  });
  assert.deepEqual(await scraper.getNames('DIM030'), { nombre: 'Figure', descripcion: 'Description' });
  assert.equal(attempts, 2);
  assert.equal(scraper.timeoutMs, 30000);
  assert.equal(scraper.minIntervalMs, 0);
  assert.equal(createCorrectionScraper().minIntervalMs, 9000);
});

test('limita los reintentos de timeout y conserva el ID como fallido sin escribir', async () => {
  let attempts = 0;
  const scraper = createCorrectionScraper({
    minIntervalMs: 0,
    fetchImpl: async () => {
      attempts += 1;
      throw new DOMException('This operation was aborted', 'AbortError');
    },
  });
  const client = { async rpc(name) {
    assert.equal(name, 'leer_correccion_nombres_brickset');
    return { data: [{ id: 'DIM030' }] };
  } };
  const summary = await correctBricksetNames({ client, brickset: scraper, apply: true, logger: silentLogger });
  assert.equal(attempts, 3);
  assert.deepEqual(summary.failedIds, ['DIM030']);
  assert.equal(summary.updatedRows, 0);
});

test('la aplicacion exige confirmar el proyecto y no acepta destinos o credenciales ambiguos', () => {
  const config = { SUPABASE_URL: 'https://prod-ref.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key' };
  assert.equal(correctionTarget(config).projectRef, 'prod-ref');
  assert.throws(() => correctionTarget(config, { apply: true }), /confirm-project/);
  assert.throws(() => correctionTarget(config, { apply: true, confirmProject: 'otro' }), /confirm-project/);
  assert.equal(correctionTarget(config, { apply: true, confirmProject: 'prod-ref' }).url, config.SUPABASE_URL);
  assert.throws(() => correctionTarget({ ...config, SUPABASE_URL: 'http://prod-ref.supabase.co' }));
  assert.throws(() => correctionTarget({ ...config, SUPABASE_SERVICE_ROLE_KEY: '' }));
});

test('pagina IDs unicos, la vista previa no escribe y los fallos de Brickset no borran nombres', async () => {
  const calls = [];
  const requested = [];
  const client = { async rpc(name, params) {
    calls.push({ name, params });
    if (name === 'aplicar_correccion_nombres_brickset') return { data: 2, error: null };
    return { data: params.p_after_id === null ? [{ id: 'A' }, { id: 'B' }] : [{ id: 'C' }], error: null };
  } };
  const brickset = { async getNames(id) {
    requested.push(id);
    if (id === 'B') throw Object.assign(new Error(), { code: 'BRICKSET_TIMEOUT' });
    return { nombre: `Name ${id}`, descripcion: null };
  } };
  const preview = await correctBricksetNames({ client, brickset, pageSize: 2, logger: silentLogger });
  assert.deepEqual(preview, { mode: 'preview', processedIds: 3, updatedRows: 0, failedIds: ['B'] });
  assert.deepEqual(requested, ['A', 'B', 'C']);
  assert.ok(calls.every(({ name }) => name === 'leer_correccion_nombres_brickset'));
  calls.length = 0;
  const applied = await correctBricksetNames({ client, brickset, apply: true, pageSize: 2, logger: silentLogger });
  assert.equal(applied.updatedRows, 4);
  assert.deepEqual(calls.filter(({ name }) => name.startsWith('aplicar')).map(({ params }) => params), [
    { p_id: 'A', p_nombre: 'Name A', p_descripcion: null },
    { p_id: 'C', p_nombre: 'Name C', p_descripcion: null },
  ]);
});

test('reintenta solo los IDs seleccionados sin consultar ni escribir los demas en ninguna pagina', async () => {
  for (const apply of [false, true]) {
    const requested = [];
    const written = [];
    const client = { async rpc(name, params) {
      if (name === 'aplicar_correccion_nombres_brickset') {
        written.push(params.p_id);
        return { data: 1 };
      }
      return { data: params.p_after_id === null ? [{ id: 'A' }, { id: 'DIM030' }] : [{ id: 'Z' }] };
    } };
    const summary = await correctBricksetNames({
      client, apply, pageSize: 2, ids: [' dim030 ', 'z', 'DIM030'], logger: silentLogger,
      brickset: { async getNames(id) {
        requested.push(id);
        return { nombre: 'Name', descripcion: null };
      } },
    });
    assert.deepEqual(requested, ['DIM030', 'Z']);
    assert.deepEqual(written, apply ? ['DIM030', 'Z'] : []);
    assert.equal(summary.processedIds, 2);
    assert.deepEqual(summary.failedIds, []);
  }
});

test('una seleccion vacia o invalida nunca inicia una pasada completa', async () => {
  for (const ids of [[], [''], ['DIM030', ''], ['INVALID ID']]) {
    await assert.rejects(correctBricksetNames({
      ids, client: { rpc() { assert.fail('No debe consultar la BD'); } }, logger: silentLogger,
    }), /lista de IDs/);
  }
});

test('un fallo de persistencia detiene el script y no se declara exito', async () => {
  const client = { async rpc(name) {
    return name.startsWith('leer') ? { data: [{ id: 'A' }] } : { error: { code: 'XX000' } };
  } };
  await assert.rejects(correctBricksetNames({
    client, apply: true, logger: silentLogger,
    brickset: { async getNames() { return { nombre: 'Name', descripcion: null }; } },
  }), /No se pudo confirmar/);
});

test('RPC puntuales restringen permisos y solo corrigen textos de filas existentes de todos los usuarios', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table public.minifiguras (
        user_id text, id text, nombre text not null, descripcion text,
        precio numeric, categoria text, fecha_registro text,
        primary key(user_id, id)
      );
      insert into public.minifiguras values
        ('a', 'CAS056', 'Old A', 'Old description', 10, 'Ninja', '2020-01-01'),
        ('b', 'CAS056', 'Old B', null, 20, 'Ninja', '2021-01-01'),
        ('b', 'COL047', 'Other', 'Obsolete description', 30, 'Collectible Minifigures', '2022-01-01');
    `);
    const migration = await readFile(new URL('../supabase/brickset-name-correction.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query('select has_function_privilege($1, $2, $3) as allowed', [
        role, 'public.leer_correccion_nombres_brickset(text,integer)', 'EXECUTE',
      ])).rows[0].allowed, false);
      assert.equal((await db.query('select has_function_privilege($1, $2, $3) as allowed', [
        role, 'public.aplicar_correccion_nombres_brickset(text,text,text)', 'EXECUTE',
      ])).rows[0].allowed, false);
    }
    await db.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
    await assert.rejects(db.query('select * from public.leer_correccion_nombres_brickset()'), /NO_AUTORIZADA/);
    await assert.rejects(db.query("select public.aplicar_correccion_nombres_brickset('CAS056', 'No', null)"), /NO_AUTORIZADA/);
    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    await db.exec('set role service_role');
    assert.deepEqual((await db.query('select * from public.leer_correccion_nombres_brickset(null, 1)')).rows, [{ id: 'CAS056' }]);
    assert.deepEqual((await db.query("select * from public.leer_correccion_nombres_brickset('CAS056', 1)")).rows, [{ id: 'COL047' }]);
    await assert.rejects(db.query('select * from public.leer_correccion_nombres_brickset(null, 0)'), /PAGINA_INVALIDA/);
    await assert.rejects(db.query("select public.aplicar_correccion_nombres_brickset('CAS056', '', null)"), /INVALIDA/);
    const update = "select public.aplicar_correccion_nombres_brickset('CAS056', 'Ninja', 'Shogun, Blue with Armor') as count";
    assert.equal((await db.query(update)).rows[0].count, 2);
    assert.equal((await db.query(update)).rows[0].count, 0);
    assert.equal((await db.query("select public.aplicar_correccion_nombres_brickset('MISSING', 'Name', null) as count")).rows[0].count, 0);
    await db.exec('reset role');
    assert.deepEqual((await db.query("select user_id, nombre, descripcion, precio::integer, categoria, fecha_registro from public.minifiguras where id = 'CAS056' order by user_id")).rows, [
      { user_id: 'a', nombre: 'Ninja', descripcion: 'Shogun, Blue with Armor', precio: 10, categoria: 'Ninja', fecha_registro: '2020-01-01' },
      { user_id: 'b', nombre: 'Ninja', descripcion: 'Shogun, Blue with Armor', precio: 20, categoria: 'Ninja', fecha_registro: '2021-01-01' },
    ]);
    await db.query("select public.aplicar_correccion_nombres_brickset('COL047', 'Baseball Player', null)");
    assert.equal((await db.query("select descripcion from public.minifiguras where id = 'COL047'")).rows[0].descripcion, null);
  } finally {
    await db.close();
  }
});