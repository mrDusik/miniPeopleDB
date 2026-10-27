import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('el recálculo global transaccional solo acepta service_role y es idempotente por fingerprint', async () => {
  const db = new PGlite();
  const userId = '00000000-0000-4000-8000-00000000000a';
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (
        instance_id uuid, id uuid primary key, aud text, role text, email text unique,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
        confirmation_token text, recovery_token text, email_change_token_new text, email_change text
      );
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id, email) values ($1, $2)', [userId, 'recalc@example.invalid']);
    const fingerprint = 'a'.repeat(64);
    const states = [{
      user_id: userId,
      bricks: 59,
      nivel: { id: 1, nombre: 'Stud' },
      siguiente_nivel: { id: 2, nombre: 'Plate' },
      progreso: { actual: 59, desde: 20, hasta: 50, porcentaje: 100 },
      logros: [{ id: 'solid-investment', bricks: 250, cantidad: 1, total: 250 }],
    }];

    await db.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
    await assert.rejects(
      db.query('select public.aplicar_recalculo_gamificacion_categorias($1, $2::jsonb)', [fingerprint, JSON.stringify(states)]),
      /RECALCULO_CATEGORIAS_NO_AUTORIZADO/,
    );
    assert.equal((await db.query('select count(*)::integer as count from public.gamificacion')).rows[0].count, 0);

    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    await assert.rejects(
      db.query('select public.aplicar_recalculo_gamificacion_categorias($1, $2::jsonb, $3)', [null, null, 'v2']),
      /RECALCULO_CATEGORIAS_INVALIDO/,
    );
    await assert.rejects(
      db.query('select public.aplicar_recalculo_gamificacion_categorias($1, $2::jsonb) as applied', [fingerprint, JSON.stringify(states)]),
      /RECALCULO_CATEGORIAS_VERSION_OBSOLETA/,
    );
    const applied = await db.query('select public.aplicar_recalculo_gamificacion_categorias($1, $2::jsonb, $3) as applied', [fingerprint, JSON.stringify(states), 'v2']);
    assert.equal(applied.rows[0].applied, true);
    const persisted = (await db.query('select bricks, logros from public.gamificacion where user_id = $1', [userId])).rows[0];
    assert.equal(persisted.bricks, 59);
    assert.deepEqual(persisted.logros, states[0].logros);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    assert.equal((await db.query('select private.dna_calcular($1) as dna', [userId])).rows[0].dna.principal, 'Collector');
    assert.equal((await db.query('select bricks from public.ranking_global() where user_id = $1', [userId])).rows[0].bricks, 59);

    const repeated = await db.query('select public.aplicar_recalculo_gamificacion_categorias($1, $2::jsonb, $3) as applied', [fingerprint, JSON.stringify([{ ...states[0], bricks: 999 }]), 'v2']);
    assert.equal(repeated.rows[0].applied, false);
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [userId])).rows[0].bricks, 59);

    await assert.rejects(
      db.query('select public.aplicar_recalculo_gamificacion_categorias($1, $2::jsonb, $3)', ['b'.repeat(64), JSON.stringify([{ ...states[0], bricks: -1 }]), 'v2']),
      /gamificacion_bricks_check/,
    );
    assert.equal((await db.query('select fingerprint from public.gamificacion_categoria_version where singleton = true')).rows[0].fingerprint, fingerprint);
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [userId])).rows[0].bricks, 59);

    assert.equal((await db.query("select has_function_privilege('anon', 'public.aplicar_recalculo_gamificacion_categorias(text,jsonb,text)', 'EXECUTE') as allowed")).rows[0].allowed, false);
    assert.equal((await db.query("select has_function_privilege('authenticated', 'public.aplicar_recalculo_gamificacion_categorias(text,jsonb,text)', 'EXECUTE') as allowed")).rows[0].allowed, false);
  } finally {
    await db.close();
  }
});

test('la RPC de fuentes de categorías pagina todos los usuarios Auth y solo la ejecuta service_role', async () => {
  const db = new PGlite();
  const userA = '00000000-0000-4000-8000-0000000000a1';
  const userB = '00000000-0000-4000-8000-0000000000b1';
  const userC = '00000000-0000-4000-8000-0000000000c1';
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (id uuid primary key, email text unique);
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4), ($5, $6)', [
      userA, 'a@example.invalid', userB, 'b@example.invalid', userC, 'c@example.invalid',
    ]);
    await db.query(`insert into public.minifiguras(user_id,id,nombre,nombre_completo,categoria,anio,estado_coleccion)
      values ($1,'FIG-A','Figure A','Figure A, Comic-Con 2026','Space',2020,'COLECCIÓN')`, [userA]);
    await db.query('insert into public.friend_requests(sender_id,recipient_id,status) values ($1,$2,$3),($4,$1,$5)', [
      userA, userB, 'pending', userC, 'accepted',
    ]);
    await db.query('insert into public.friendships(user_low_id,user_high_id) values ($1,$2)', [
      [userA, userC].sort()[0], [userA, userC].sort()[1],
    ]);
    await db.query('insert into public.regalos_enviados(donante_id,receptor_id,semana) values ($1,$2,$3),($4,$5,$6),($7,$8,$9)', [
      userC, userB, '0001-01-01', userB, userC, '2026-10-26', userC, userA, '0001-01-01',
    ]);
    const giftNotification = (await db.query(`insert into public.notificaciones(user_id,type,payload,gift_donante_id)
      values ($1,'gift_received','{"amount":50}'::jsonb,$2) returning id`, [userA, userC])).rows[0];
    await db.query('insert into public.agradecimientos_regalo(gift_notification_id,thanker_id,donor_id) values ($1,$2,$3)', [
      giftNotification.id, userA, userC,
    ]);

    assert.equal((await db.query("select has_function_privilege('anon', 'public.leer_recalculo_gamificacion_categorias(uuid,integer)', 'EXECUTE') as allowed")).rows[0].allowed, false);
    assert.equal((await db.query("select has_function_privilege('authenticated', 'public.leer_recalculo_gamificacion_categorias(uuid,integer)', 'EXECUTE') as allowed")).rows[0].allowed, false);
    await db.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
    await assert.rejects(db.query('select public.leer_recalculo_gamificacion_categorias(null, 2)'), /RECALCULO_CATEGORIAS_NO_AUTORIZADO/);
    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");

    const first = (await db.query('select public.leer_recalculo_gamificacion_categorias(null, 2) as data')).rows[0].data;
    assert.equal(first.version, 'v2');
    assert.equal(first.fingerprint, '');
    assert.deepEqual(first.users, [userA, userB]);
    assert.equal(first.has_more, true);
    assert.equal(first.next_cursor, userB);
    assert.deepEqual(Object.keys(first.figures[0]).sort(), [
      'user_id', 'id', 'nombreCompleto', 'categoria', 'subcategoria', 'anio', 'estado_coleccion', 'precio', 'precio_compra',
    ].sort());
    assert.equal(first.figures[0].nombreCompleto, 'Figure A, Comic-Con 2026');
    assert.equal(first.social_sources.find(({ user_id }) => user_id === userA).sent_pending, 1);
    assert.equal(first.social_sources.find(({ user_id }) => user_id === userA).accepted_received, 1);
    assert.equal(first.social_sources.find(({ user_id }) => user_id === userA).thanks_sent, 1);
    assert.equal(first.social_sources.find(({ user_id }) => user_id === userB).global_gifts_received, 1);

    const second = (await db.query('select public.leer_recalculo_gamificacion_categorias($1, 2) as data', [first.next_cursor])).rows[0].data;
    assert.deepEqual(second.users, [userC]);
    assert.equal(second.has_more, false);
    assert.equal(second.next_cursor, null);
    assert.equal(second.social_sources[0].friends, 1);
    assert.equal(second.social_sources[0].weekly_gifts_received, 1);
    assert.equal(second.social_sources[0].thanks_received, 1);
    await assert.rejects(db.query('select public.leer_recalculo_gamificacion_categorias(null, 1001)'), /RECALCULO_CATEGORIAS_PAGINACION_INVALIDA/);
  } finally {
    await db.close();
  }
});