import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { calcularGamificacion, DNA_PONDERACIONES, LOGRO_REGALO, OBJETIVOS, proyectarPesosDnaSql } from '../src/gamificacion.js';
import { GamificacionRepository } from '../src/gamificacion-repository.js';
import { MinifigurasRepository } from '../src/minifiguras-repository.js';
import { getCronSecret, getSupabaseAdminConfig, getSupabaseConfig } from '../src/services/supabase.js';
import { createSupabaseMock } from '../test-support/supabase-mock.js';

test('backfill de usernames ordena perfiles legados, salta colisiones y es idempotente', async () => {
  const db = new PGlite();
  const firstLegacyId = '00000000-0000-4000-8000-0000000000a1';
  const secondLegacyId = '00000000-0000-4000-8000-0000000000b1';
  const collisionId = '00000000-0000-4000-8000-0000000000c1';
  const customId = '00000000-0000-4000-8000-0000000000d1';
  const completedId = '00000000-0000-4000-8000-0000000000e1';
  const lastLegacyId = '00000000-0000-4000-8000-0000000000f1';
  const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
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
    await db.exec(schema);
    await db.exec('drop index public.user_profiles_username_lower_uidx');
    await db.query(`
      insert into auth.users(id, email) values
        ($1, 'a@example.invalid'), ($2, 'b@example.invalid'), ($3, 'c@example.invalid'),
        ($4, 'd@example.invalid'), ($5, 'e@example.invalid'), ($6, 'f@example.invalid')
    `, [firstLegacyId, secondLegacyId, collisionId, customId, completedId, lastLegacyId]);
    await db.query(`
      insert into public.user_profiles(user_id, username, onboarding_completed, created_at) values
        ($1, 'Coleccionista', false, '2020-01-01T00:00:00Z'),
        ($2, 'Coleccionista', false, '2020-01-01T00:00:00Z'),
        ($3, 'coLECCIONISTA1', false, '2019-01-01T00:00:00Z'),
        ($4, 'CustomName', false, '2018-01-01T00:00:00Z'),
        ($5, 'Coleccionista', true, '2017-01-01T00:00:00Z'),
        ($6, 'Coleccionista', false, '2021-01-01T00:00:00Z')
    `, [firstLegacyId, secondLegacyId, collisionId, customId, completedId, lastLegacyId]);
    await db.query(`
      insert into public.perfiles_publicos(user_id, display_name, avatar_url) values
        ($1, 'Coleccionista', 'https://avatar.example/legacy.png'),
        ($2, 'CustomName', null), ($3, 'Coleccionista', null)
    `, [firstLegacyId, customId, completedId]);

    await db.exec(schema);
    const profiles = (await db.query(`
      select profiles.user_id, profiles.username, profiles.onboarding_completed, public_profiles.display_name
      from public.user_profiles profiles
      left join public.perfiles_publicos public_profiles using (user_id)
      order by profiles.user_id
    `)).rows;
    const byId = Object.fromEntries(profiles.map((profile) => [profile.user_id, profile]));
    assert.equal(byId[firstLegacyId].username, 'Coleccionista2');
    assert.equal(byId[firstLegacyId].display_name, 'Coleccionista2');
    assert.equal(byId[secondLegacyId].username, 'Coleccionista3');
    assert.equal(byId[secondLegacyId].display_name, 'Coleccionista3');
    assert.equal(byId[lastLegacyId].username, 'Coleccionista4');
    assert.equal(byId[collisionId].username, 'coLECCIONISTA1');
    assert.equal(byId[customId].username, 'CustomName');
    assert.equal(byId[completedId].username, 'Coleccionista');
    assert.equal(byId[completedId].display_name, 'Coleccionista');
    assert.equal((await db.query('select avatar_url from public.perfiles_publicos where user_id = $1', [firstLegacyId])).rows[0].avatar_url, 'https://avatar.example/legacy.png');

    await db.exec(schema);
    assert.deepEqual((await db.query('select user_id, username from public.user_profiles order by user_id')).rows,
      profiles.map(({ user_id, username }) => ({ user_id, username })));
  } finally {
    await db.close();
  }
});

test('RPC de perfil ajeno limita campos, ordena resumen y conserva RLS directo', async () => {
  const db = new PGlite();
  const viewerId = '00000000-0000-4000-8000-0000000000a1';
  const profileId = '00000000-0000-4000-8000-0000000000b1';
  const setActor = async (userId) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    await db.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
    await db.exec('set role authenticated');
  };
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      grant usage on schema auth to authenticated;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (id uuid primary key, email text unique);
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4)', [
      viewerId, 'viewer@example.invalid', profileId, 'private@example.invalid',
    ]);
    await db.query(`
      insert into public.user_profiles(user_id, username, currency, language, avatar_url)
      values ($1, 'BrickFan', 'EUR', 'es', 'https://avatar.example/profile.png')
    `, [profileId]);
    await db.query(`
      insert into public.perfiles_publicos(user_id, display_name, avatar_url)
      values ($1, 'OAuth private name', 'https://avatar.example/public.png')
    `, [profileId]);
    await db.query(`
      insert into public.gamificacion(user_id, bricks, nivel, logros) values ($1, 123,
        '{"id":4,"nombre":"Citizen","private":"hidden"}',
        '[
          {"id":"tie-first","type":"normal","nombre":"Tie first","total":25,"email":"hidden"},
          {"id":"gift-first","type":"regalo","nombre":"Gift first","total":500},
          {"id":"high","type":"normal","nombre":"High","total":50},
          {"id":"tie-second","type":"normal","nombre":"Tie second","total":25},
          {"id":"gift-second","type":"regalo","nombre":"Gift second","total":1}
        ]')
    `, [profileId]);
    await db.query(`
      insert into public.minifiguras(user_id, id, nombre, categoria, estado_coleccion, anio, precio,
        precio_compra, fecha_compra, fecha_registro) values
        ($1, 'A-1', 'Older', 'Space', 'COLECCIÓN', 1980, 20, 3, '2020-01-01', '2024-01-01'),
        ($1, 'A-2', 'Newest', 'Castle', 'COLECCIÓN', 2000, 50, 4, '2021-01-01', '2026-01-01'),
        ($1, 'A-3', 'Middle', 'City', 'COLECCIÓN', 1990, 35, 5, '2022-01-01', '2025-01-01'),
        ($1, 'B-1', 'Wanted old', 'Space', 'BUSCADA', 1970, 10, 1, '2019-01-01', '2025-02-01'),
        ($1, 'B-2', 'Wanted new', 'Castle', 'BUSCADA', 2020, 15, 2, '2020-01-01', '2026-02-01')
    `, [profileId]);
    await db.query(`
      insert into public.gamificacion(user_id, logros) values ($1,
        '[{"id":"collector","type":"normal","cantidad":1},{"id":"nerd","type":"normal","cantidad":1}]');
    `, [viewerId]);

    assert.equal((await db.query("select has_function_privilege('anon', 'public.amigos_perfil(uuid)', 'EXECUTE') as allowed")).rows[0].allowed, false);
    await setActor(viewerId);
    await assert.rejects(db.query('select public.amigos_perfil($1)', [viewerId]), /PERFIL_NO_PERMITIDO/);
    const result = (await db.query('select public.amigos_perfil($1) as result', [profileId])).rows[0].result;
    assert.deepEqual(Object.keys(result).sort(), [
      'achievements', 'avatarUrl', 'bricks', 'collection', 'dna', 'level', 'top5Age', 'top5Price', 'userId', 'username', 'wanted',
    ]);
    assert.equal(result.username, 'BrickFan');
    assert.equal(result.avatarUrl, 'https://avatar.example/profile.png');
    assert.equal(result.bricks, 123);
    assert.deepEqual(result.level, { id: 4, name: 'Citizen' });
    assert.deepEqual(Object.keys(result.dna).sort(), ['collector', 'explorer', 'fan', 'rarityHunter']);
    assert.equal(result.collection.total, 3);
    assert.deepEqual(result.collection.latest.map(({ id }) => id), ['A-2', 'A-3', 'A-1']);
    assert.deepEqual(result.wanted.latest.map(({ id }) => id), ['B-2', 'B-1']);
    assert.deepEqual(result.top5Price.map(({ id }) => id), ['A-2', 'A-3', 'A-1']);
    assert.deepEqual(result.top5Age.map(({ id }) => id), ['A-1', 'A-3', 'A-2']);
    assert.deepEqual(result.achievements.map(({ id }) => id), ['high', 'tie-first', 'tie-second', 'gift-first', 'gift-second']);
    const serialized = JSON.stringify(result);
    for (const privateField of ['email', 'currency', 'language', 'precio_compra', 'fecha_compra', 'private']) {
      assert.equal(serialized.includes(privateField), false, privateField);
    }
    assert.equal((await db.query("select has_table_privilege('authenticated', 'public.minifiguras', 'SELECT') as allowed")).rows[0].allowed, false);
    assert.equal((await db.query("select has_table_privilege('authenticated', 'public.gamificacion', 'SELECT') as allowed")).rows[0].allowed, false);
    await assert.rejects(db.query('select user_id from public.minifiguras'), /permission denied/);
    await assert.rejects(db.query('select user_id from public.gamificacion'), /permission denied/);
    assert.equal((await db.query('select public.amigos_perfil($1) as result', ['00000000-0000-4000-8000-0000000000c1'])).rows[0].result, null);
    await db.exec('reset role');
    await db.query(`update public.gamificacion set logros = logros ||
      '[{"id":"last","nombre":"Last","cantidad":20,"total":0,"dna_weights":{"fan":100}}]'::jsonb
      where user_id = $1`, [profileId]);
    await setActor(profileId);
    await db.query("select public.establecer_logro_destacado('last', true)");
    await setActor(viewerId);
    const before = (await db.query('select public.ranking_logros($1) as result', [profileId])).rows[0].result;
    const featuredProfile = (await db.query('select public.amigos_perfil($1) as result', [profileId])).rows[0].result;
    assert.equal(featuredProfile.achievements.length, 5);
    assert.equal(featuredProfile.achievements[0].id, 'last');
    assert.equal(featuredProfile.achievements[0].featured, true);
    assert.equal(before.logros[0].destacado, true);
    assert.deepEqual(featuredProfile.achievements.map(({ id }) => id), before.logros.slice(0, 5).map(({ id }) => id));
    assert.equal(JSON.stringify(before).includes('dna_weights'), false);
    assert.deepEqual((await db.query('select public.ranking_logros($1) as result', [profileId])).rows[0].result, before);
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});

test('RPC de amigos aísla participantes y gestiona solicitudes de forma atómica e idempotente', async () => {
  const db = new PGlite();
  const userA = '00000000-0000-4000-8000-0000000000a1';
  const userB = '00000000-0000-4000-8000-0000000000b1';
  const userC = '00000000-0000-4000-8000-0000000000c1';
  const setActor = async (userId) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    await db.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
    await db.exec('set role authenticated');
  };
  const socialSourceCounts = async () => {
    const source = (await db.query('select public.gamificacion_social_fuentes() as data')).rows[0].data;
    assert.match(source.source_revision, /^[\da-f]{32}$/);
    const { source_revision, ...counts } = source;
    return counts;
  };
  const readGamificationLogros = async (userId) => {
    await db.exec('reset role');
    const logros = (await db.query('select logros from public.gamificacion where user_id = $1', [userId])).rows[0].logros;
    await db.exec('set role authenticated');
    return logros;
  };
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      grant usage on schema auth to authenticated;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (id uuid primary key, email text unique);
    `);
    const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
    await db.exec(schema);
    await db.exec(`
      alter table public.notificaciones drop constraint notificaciones_type_check;
      alter table public.notificaciones add constraint notificaciones_type_check check (
        type in ('gift_received', 'gift_thanks', 'ranking_entered', 'ranking_exited', 'daily_summary')
      );
    `);
    await db.exec(schema);
    await db.exec(`
      alter table public.notificaciones drop constraint notificaciones_type_check;
      alter table public.notificaciones add constraint notificaciones_type_check check (
        type in ('gift_received', 'gift_thanks', 'ranking_entered', 'ranking_exited', 'daily_summary')
      );
    `);
    const notificationMigration = await readFile(new URL('../supabase/friend-notification-types.sql', import.meta.url), 'utf8');
    await db.exec(notificationMigration);
    await db.exec(notificationMigration);
    const socialMigration = await readFile(new URL('../supabase/friends-social-upgrade.sql', import.meta.url), 'utf8');
    await db.exec(socialMigration);
    await db.exec(socialMigration);
    await db.exec(`
      drop policy "Recipients can view friend requests" on public.friend_requests;
      create policy "Participants can view friend requests" on public.friend_requests for select
      to authenticated using (auth.uid() in (sender_id, recipient_id));
    `);
    const privacyMigration = await readFile(new URL('../supabase/friend-request-privacy.sql', import.meta.url), 'utf8');
    await db.exec(privacyMigration);
    await db.exec(privacyMigration);
    await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4), ($5, $6)', [
      userA, 'a@example.invalid', userB, 'b@example.invalid', userC, 'c@example.invalid',
    ]);
    await db.query('insert into public.user_profiles(user_id, username) values ($1, $2), ($3, $4), ($5, $6)', [
      userA, 'SpaceFan', userB, 'BrickFan', userC, 'CastleFan',
    ]);
    await db.query('insert into public.gamificacion(user_id, bricks) values ($1, 20), ($2, 40)', [userA, userB]);

    assert.equal((await db.query("select has_function_privilege('anon', 'public.amigos_enviar(uuid)', 'EXECUTE') as allowed")).rows[0].allowed, false);
    assert.equal((await db.query("select has_function_privilege('anon', 'public.gamificacion_social_fuentes()', 'EXECUTE') as allowed")).rows[0].allowed, false);
    await setActor(userA);
    assert.deepEqual((await db.query('select public.amigos_contadores() as data')).rows[0].data, { friends: 0, sent: 0, received: 0 });
    assert.deepEqual(await socialSourceCounts(), {
      friends: 0, sent_pending: 0, accepted_sent: 0, accepted_received: 0,
      global_gifts_received: 0, weekly_gifts_received: 0, thanks_sent: 0, thanks_received: 0,
    });
    await assert.rejects(db.query('select public.gamificacion_social_fuentes($1)', [userB]), /function public\.gamificacion_social_fuentes/);
    await db.exec('reset role');
    await db.query('insert into public.regalos_enviados(donante_id, receptor_id, semana) values ($1, $2, $3), ($4, $2, $5)', [
      userB, userA, '0001-01-01', userC, '2026-10-26',
    ]);
    const giftNotifications = (await db.query(`
      insert into public.notificaciones(user_id, type, payload, gift_donante_id, gift_semana)
      values ($1, 'gift_received', '{}'::jsonb, $2, '0001-01-01'),
        ($1, 'gift_received', '{}'::jsonb, $3, '2026-10-26')
      returning id
    `, [userA, userB, userC])).rows;
    await db.query('insert into public.agradecimientos_regalo(gift_notification_id, thanker_id, donor_id) values ($1, $2, $3)', [
      giftNotifications[0].id, userA, userB,
    ]);
    await setActor(userA);
    assert.deepEqual(await socialSourceCounts(), {
      friends: 0, sent_pending: 0, accepted_sent: 0, accepted_received: 0,
      global_gifts_received: 1, weekly_gifts_received: 1, thanks_sent: 1, thanks_received: 0,
    });
    const summaries = (await db.query("select public.amigos_resumen('search', 'FAN') as data")).rows[0].data;
    assert.equal(summaries[0].total_coleccion, 0);
    assert.equal(summaries[0].dna_principal, 'Newbie');
    assert.deepEqual(summaries[0].dna_rasgos, []);
    assert.equal(summaries[0].posicion_global, 1);
    await assert.rejects(db.query('select public.amigos_buscar($1)', ['ab']), /CONSULTA_DEMASIADO_CORTA/);
    const search = await db.query('select user_id, username, bricks, relationship_status from public.amigos_buscar($1)', ['FAN']);
    assert.deepEqual(search.rows, [
      { user_id: userB, username: 'BrickFan', bricks: 40, relationship_status: 'none' },
      { user_id: userC, username: 'CastleFan', bricks: 0, relationship_status: 'none' },
    ]);
    await assert.rejects(
      db.query('insert into public.friend_requests(sender_id, recipient_id) values ($1, $2)', [userA, userC]),
      /permission denied/,
    );
    await assert.rejects(
      db.query('insert into public.friendships(user_low_id, user_high_id) values ($1, $2)', [userA, userC]),
      /permission denied/,
    );
    await assert.rejects(db.query('select public.amigos_enviar($1)', [userA]), /AUTORRELACION_NO_PERMITIDA/);
    const sent = (await db.query('select public.amigos_enviar($1) as result', [userB])).rows[0].result;
    const requestId = sent.requestId;
    assert.equal(sent.status, 'pending');
    assert.equal((await socialSourceCounts()).sent_pending, 1);
    assert.equal((await readGamificationLogros(userA)).find(({ id }) => id === 'first-contact')?.total, 2);
    assert.deepEqual((await db.query('select public.amigos_contadores() as data')).rows[0].data, { friends: 0, sent: 1, received: 0 });
    await assert.rejects(db.query('select public.amigos_enviar($1)', [userB]), /SOLICITUD_EXISTENTE/);
    await setActor(userB);
    await assert.rejects(db.query('select public.amigos_enviar($1)', [userA]), /SOLICITUD_EXISTENTE/);
    assert.equal((await db.query("select count(*)::integer as total from public.notificaciones where type = 'friend_request'")).rows[0].total, 1);
    await setActor(userA);
    assert.deepEqual((await db.query('select sender_id from public.friend_requests')).rows, []);
    await db.exec('reset role');

    await setActor(userC);
    assert.deepEqual((await db.query('select id from public.friend_requests')).rows, []);
    await assert.rejects(db.query('select public.amigos_aceptar($1)', [requestId]), /SOLICITUD_NO_ENCONTRADA/);
    await db.exec('reset role');

    await setActor(userB);
    assert.deepEqual((await db.query('select status from public.amigos_listar($1)', ['received'])).rows, [{ status: 'pending' }]);
    await db.query('select public.amigos_rechazar($1)', [requestId]);
    await setActor(userA);
    assert.deepEqual((await db.query('select status from public.friend_requests')).rows, []);
    assert.equal((await readGamificationLogros(userA)).some(({ id }) => id === 'first-contact'), false);
    assert.deepEqual(await socialSourceCounts(), {
      friends: 0, sent_pending: 0, accepted_sent: 0, accepted_received: 0,
      global_gifts_received: 1, weekly_gifts_received: 1, thanks_sent: 1, thanks_received: 0,
    });
    assert.deepEqual((await db.query("select status from public.amigos_listar('sent')")).rows, [{ status: 'pending' }]);
    assert.equal((await db.query("select relationship_status from public.amigos_buscar('Brick')")).rows[0].relationship_status, 'request_sent');
    assert.equal((await db.query("select public.amigos_resumen('sent') as data")).rows[0].data[0].status, 'pending');
    await assert.rejects(db.query('select public.amigos_enviar($1)', [userB]), /SOLICITUD_EXISTENTE/);
    await setActor(userB);
    assert.deepEqual((await db.query('select public.amigos_contadores() as data')).rows[0].data, { friends: 0, sent: 0, received: 1 });
    assert.deepEqual((await db.query('select status from public.amigos_listar($1)', ['received'])).rows, [{ status: 'rejected' }]);
    assert.equal((await db.query("select count(*)::integer as total from public.notificaciones where type = 'friend_request_accepted'")).rows[0].total, 0);
    await db.query('select public.amigos_aceptar($1)', [requestId]);
    assert.deepEqual((await db.query('select public.amigos_contadores() as data')).rows[0].data, { friends: 1, sent: 0, received: 0 });
    assert.equal((await socialSourceCounts()).accepted_received, 1);
    assert.equal((await readGamificationLogros(userB)).find(({ id }) => id === 'handshake')?.total, 3);
    assert.deepEqual((await db.query('select status from public.amigos_listar($1)', ['friends'])).rows, [{ status: 'accepted' }]);
    assert.equal((await db.query("select count(*)::integer as total from public.notificaciones where type = 'friend_request_accepted'")).rows[0].total, 0);
    await setActor(userB);
    assert.equal((await socialSourceCounts()).accepted_received, 1);
    assert.deepEqual((await db.query("select social_request_accepted, is_read from public.notificaciones where type = 'friend_request'")).rows, [
      { social_request_accepted: true, is_read: false },
    ]);
    await setActor(userA);
    assert.equal((await socialSourceCounts()).accepted_sent, 1);
    assert.equal((await readGamificationLogros(userA)).find(({ id }) => id === 'first-contact')?.total, 2);
    assert.deepEqual((await db.query('select status from public.amigos_listar($1)', ['received'])).rows, []);
    assert.equal((await db.query("select count(*)::integer as total from public.notificaciones where type = 'friend_request_accepted'")).rows[0].total, 1);
    await setActor(userB);
    assert.equal((await db.query('select public.amigos_aceptar($1) as result', [requestId])).rows[0].result.alreadyAccepted, true);
    await assert.rejects(db.query('select public.amigos_rechazar($1)', [requestId]), /SOLICITUD_YA_ACEPTADA/);
    await db.exec('reset role');

    await db.exec(`
      create function public.refuse_social_notification() returns trigger language plpgsql as $$
      begin raise exception 'NOTIFICATION_FAILURE'; end; $$;
      create trigger refuse_social_notification before insert on public.notificaciones
      for each row when (new.type = 'friend_request') execute function public.refuse_social_notification();
    `);
    await setActor(userC);
    await assert.rejects(db.query('select public.amigos_enviar($1)', [userB]), /NOTIFICATION_FAILURE/);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::integer as total from public.friend_requests')).rows[0].total, 1);
    assert.equal((await db.query('select count(*)::integer as total from public.friendships')).rows[0].total, 1);
    await db.exec('drop trigger refuse_social_notification on public.notificaciones; drop function public.refuse_social_notification();');

    await setActor(userC);
    const secondRequest = (await db.query('select public.amigos_enviar($1) as result', [userA])).rows[0].result;
    await db.exec('reset role');
    await db.exec(`
      create function public.refuse_social_accept_notification() returns trigger language plpgsql as $$
      begin raise exception 'ACCEPT_NOTIFICATION_FAILURE'; end; $$;
      create trigger refuse_social_accept_notification before insert on public.notificaciones
      for each row when (new.type = 'friend_request_accepted') execute function public.refuse_social_accept_notification();
    `);
    await setActor(userA);
    await assert.rejects(db.query('select public.amigos_aceptar($1)', [secondRequest.requestId]), /ACCEPT_NOTIFICATION_FAILURE/);
    assert.deepEqual((await db.query('select status from public.amigos_listar($1)', ['received'])).rows, [{ status: 'pending' }]);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::integer as total from public.friendships')).rows[0].total, 1);
    assert.equal((await db.query("select count(*)::integer as total from public.notificaciones where type = 'friend_request_accepted'")).rows[0].total, 1);
    await db.exec('drop trigger refuse_social_accept_notification on public.notificaciones; drop function public.refuse_social_accept_notification();');
    await setActor(userA);
    await db.query('select public.amigos_aceptar($1)', [secondRequest.requestId]);
    assert.equal((await db.query('select status from public.amigos_listar($1)', ['friends'])).rows.length, 2);
    await db.exec('reset role');
    await db.query(`update public.gamificacion set nivel = '{"id":2,"private":"hidden"}',
      logros = '[{"id":"solid-investment","cantidad":1}]' where user_id = $1` , [userB]);
    await db.query(`update public.gamificacion set nivel = '{"id":3}', bricks = 1 where user_id = $1`, [userC]);
    await db.query("insert into public.minifiguras(user_id, id, nombre, categoria) values ($1, 'SOCIAL-1', 'Figure', 'Space')", [userB]);
    await setActor(userA);
    const enriched = (await db.query("select public.amigos_resumen('search', 'Brick') as data")).rows[0].data[0];
    await db.exec('reset role');
    const expectedPosition = (await db.query(`select position from (
      select user_id, row_number() over (
        order by coalesce((nivel->>'id')::numeric, 0) desc, bricks desc, user_id asc
      ) as position from public.gamificacion
    ) ranked where user_id = $1`, [userB])).rows[0].position;
    assert.equal(enriched.posicion_global, expectedPosition);
    assert.equal(enriched.total_coleccion, 1);
    assert.equal(enriched.dna_principal, 'Collector');
    assert.deepEqual(Object.keys(enriched.nivel).sort(), ['id', 'nombre']);
    assert.equal(enriched.dna_rasgos.length, 2);
    assert.deepEqual(Object.keys(enriched.dna_rasgos[0]).sort(), ['nombre', 'porcentaje']);
    assert.equal(enriched.dna_rasgos[0].nombre, 'Collector');
    assert.equal('logros' in enriched, false);
    await db.exec('reset role');
    await db.exec(`
      create function private.refuse_social_delete() returns trigger language plpgsql as $$
      begin raise exception 'DELETE_FAILURE'; end; $$;
      create trigger refuse_social_delete before delete on public.friend_requests
      for each row execute function private.refuse_social_delete();
    `);
    await setActor(userA);
    await assert.rejects(db.query('select public.amigos_eliminar($1)', [userB]), /DELETE_FAILURE/);
    assert.equal((await db.query("select count(*)::integer as total from public.friendships")).rows[0].total, 2);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::integer as total from public.notificaciones where social_request_id = $1', [requestId])).rows[0].total, 2);
    await db.exec('drop trigger refuse_social_delete on public.friend_requests');
    await setActor(userC);
    assert.equal((await db.query('select public.amigos_eliminar($1) as data', [userB])).rows[0].data.removed, false);
    await setActor(userB);
    assert.equal((await db.query('select public.amigos_eliminar($1) as data', [userA])).rows[0].data.removed, true);
    assert.equal((await db.query('select public.amigos_eliminar($1) as data', [userA])).rows[0].data.removed, false);
    await setActor(userA);
    assert.deepEqual(await socialSourceCounts(), {
      friends: 1, sent_pending: 0, accepted_sent: 0, accepted_received: 1,
      global_gifts_received: 1, weekly_gifts_received: 1, thanks_sent: 1, thanks_received: 0,
    });
    assert.equal((await readGamificationLogros(userA)).some(({ id }) => id === 'first-contact'), false);
    assert.equal((await readGamificationLogros(userB)).some(({ id }) => id === 'handshake'), false);
    await assert.rejects(db.query('select public.amigos_aceptar($1)', [requestId]), /SOLICITUD_NO_ENCONTRADA/);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::integer as total from public.notificaciones where social_request_id = $1', [requestId])).rows[0].total, 0);
    await setActor(userA);
    assert.equal((await db.query('select public.amigos_enviar($1) as data', [userB])).rows[0].data.status, 'pending');
    assert.equal((await db.query('select public.amigos_eliminar($1) as data', [userB])).rows[0].data.removed, false);
    assert.equal((await db.query("select status from public.amigos_listar('sent') where user_id = $1", [userB])).rows[0].status, 'pending');
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select public.amigos_contadores()'), /permission denied/);
    await assert.rejects(db.query('select public.amigos_eliminar($1)', [userB]), /permission denied/);
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});

test('resolver username exige contraseña, limita intentos y no concede lectura global a anon', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const userId = '00000000-0000-4000-8000-0000000000a1';
  try {
    await db.exec(`
      create schema auth;
      create schema private;
      create role anon;
      create role authenticated;
      create table auth.users (id uuid primary key, email text, encrypted_password text);
      create table public.user_profiles (user_id uuid primary key references auth.users(id), username text);
      revoke all on auth.users, public.user_profiles from public, anon, authenticated;
    `);
    const migration = await readFile(new URL('../supabase/username-login.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    await db.query("insert into auth.users values ($1, $2, extensions.crypt($3, extensions.gen_salt('bf', 6)))", [userId, 'private@example.invalid', 'Abcd1']);
    await db.query('insert into public.user_profiles values ($1, $2)', [userId, 'SpaceFan']);
    await db.exec('set role anon');
    const resolveUsername = async (username, password) => (await db.query('select public.resolver_acceso_username($1, $2) as email', [username, password])).rows[0].email;
    assert.equal(await resolveUsername('Unknown', 'Abcd1'), null);
    assert.equal(await resolveUsername('SpaceFan', 'wrong'), null);
    assert.equal(await resolveUsername('SPACEFAN', 'Abcd1'), 'private@example.invalid');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.equal(await resolveUsername('spacefan', 'wrong'), null);
    }
    assert.equal(await resolveUsername('SpaceFan', 'Abcd1'), null);
    assert.equal(await resolveUsername(null, 'Abcd1'), null);
    assert.equal(await resolveUsername('SpaceFan', null), null);
    await assert.rejects(db.query('select * from auth.users'), /permission denied/);
    await assert.rejects(db.query('select * from public.user_profiles'), /permission denied/);
    await assert.rejects(db.query('select * from private.username_login_attempts'), /permission denied/);
    await db.exec('reset role');
    assert.equal((await db.query("select has_function_privilege('authenticated', 'public.resolver_acceso_username(text,text)', 'EXECUTE') as allowed")).rows[0].allowed, false);
    await db.exec("update private.username_login_attempts set window_start = clock_timestamp() - interval '2 minutes'");
    await db.exec('set role anon');
    assert.equal(await resolveUsername('SpaceFan', 'Abcd1'), 'private@example.invalid');
    await db.exec('reset role');
    await db.exec("update auth.users set encrypted_password = ''");
    await db.exec('set role anon');
    assert.equal(await resolveUsername('SpaceFan', 'Abcd1'), null);
  } finally {
    await db.close();
  }
});

test('el bucket de avatares limita formatos y escritura y borrado a la carpeta del JWT', async () => {
  const db = new PGlite();
  const userId = '00000000-0000-4000-8000-0000000000a1';
  const otherId = '00000000-0000-4000-8000-0000000000b1';
  const filename = '00000000-0000-4000-8000-000000000001.png';
  try {
    await db.exec(`
      create schema auth;
      create schema storage;
      create role anon;
      create role authenticated;
      grant usage on schema auth, storage to anon, authenticated;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
      create function storage.foldername(name text) returns text[] language sql as $$
        select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1]
      $$;
      alter table storage.objects enable row level security;
      grant select, insert, delete on storage.objects to authenticated;
      grant select on storage.objects to anon;
    `);
    const migration = await readFile(new URL('../supabase/profile-avatars.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    const bucket = (await db.query("select * from storage.buckets where id = 'profile-avatars'")).rows[0];
    assert.equal(bucket.public, true);
    assert.equal(Number(bucket.file_size_limit), 2097152);
    assert.deepEqual(bucket.allowed_mime_types, ['image/png', 'image/jpeg', 'image/webp']);
    await db.query("insert into storage.objects(bucket_id, name) values ('profile-avatars', $1)", [`${otherId}/${filename}`]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    await db.exec('set role authenticated');
    await db.query("insert into storage.objects(bucket_id, name) values ('profile-avatars', $1)", [`${userId}/${filename}`]);
    assert.deepEqual((await db.query('select name from storage.objects')).rows, [{ name: `${userId}/${filename}` }]);
    for (const path of [`${otherId}/${filename}`, `${userId}/avatar.svg`, `${userId}/nested/${filename}`]) {
      await assert.rejects(db.query("insert into storage.objects(bucket_id, name) values ('profile-avatars', $1)", [path]), /row-level security/);
    }
    assert.equal((await db.query('delete from storage.objects where name = $1 returning name', [`${otherId}/${filename}`])).rows.length, 0);
    assert.equal((await db.query('delete from storage.objects where name = $1 returning name', [`${userId}/${filename}`])).rows.length, 1);
    await db.exec('reset role; set role anon');
    assert.deepEqual((await db.query('select name from storage.objects')).rows, []);
    await assert.rejects(db.query("insert into storage.objects(bucket_id, name) values ('profile-avatars', $1)", [`${userId}/${filename}`]), /permission denied/);
  } finally {
    await db.close();
  }
});

test('los rankings leen username aunque el nombre público de Google siga desactualizado', async () => {
  const db = new PGlite();
  const viewerId = '00000000-0000-4000-8000-0000000000a1';
  const rankedId = '00000000-0000-4000-8000-0000000000b1';
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
    await db.query(`insert into private.gamificacion_v2_activation(singleton, version, activated_at, available_from)
      values (true, 'v2', '2026-10-08T12:00:00Z', '2026-10-12')`);
    await db.query('insert into auth.users values ($1, $2), ($3, $4)', [viewerId, 'viewer@example.invalid', rankedId, 'ranked@example.invalid']);
    await db.query('insert into public.user_profiles(user_id, username) values ($1, $2), ($3, $4)', [viewerId, 'Viewer_1', rankedId, 'SpaceFan_2']);
    await db.query('insert into public.perfiles_publicos(user_id, display_name) values ($1, $2)', [rankedId, 'Nombre Google antiguo']);
    await db.query("insert into public.gamificacion(user_id, bricks, nivel) values ($1, 100, '{\"id\":1,\"nombre\":\"Stud\"}')", [rankedId]);
    await db.query(`insert into public.user_daily_snapshots (
      user_id, snapshot_date, total_figures, total_value, bricks, level,
      pct_collector, pct_explorer, pct_rarity_hunter, pct_fan, calculation_version
    ) values ($1, '2026-10-11', 0, 0, 50, 1, 0, 0, 0, 0, 'v2'),
      ($1, '2026-10-12', 0, 0, 100, 1, 0, 0, 0, 0, 'v2')`, [rankedId]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [viewerId]);
    await db.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
    await db.exec('set role authenticated');
    assert.deepEqual((await db.query('select username from public.user_profiles where user_id = $1', [rankedId])).rows, []);
    assert.equal((await db.query('select display_name from public.ranking_global() where user_id = $1', [rankedId])).rows[0].display_name, 'SpaceFan_2');
    assert.equal((await db.query('select public.ranking_logros($1) as result', [rankedId])).rows[0].result.displayName, 'SpaceFan_2');
    await db.exec('reset role');
    const weekly = (await db.query("select private.ranking_semanal_calcular('2026-10-15T12:00:00Z'::timestamptz) as result")).rows[0].result;
    assert.equal(weekly.entries[0].displayName, 'SpaceFan_2');
    assert.equal((await db.query('select display_name from public.perfiles_publicos where user_id = $1', [rankedId])).rows[0].display_name, 'Nombre Google antiguo');
  } finally {
    await db.close();
  }
});

test('eliminar_cuenta_usuario limita el borrado a auth.uid, aplica cascada y revierte fallos', async () => {
  const db = new PGlite();
  const userA = '00000000-0000-4000-8000-0000000000a1';
  const userB = '00000000-0000-4000-8000-0000000000b1';
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
    await db.query('insert into auth.users values ($1, $2), ($3, $4)', [userA, 'a@example.invalid', userB, 'b@example.invalid']);
    for (const [userId, username] of [[userA, 'SpaceFan'], [userB, 'OtherFan']]) {
      await db.query('insert into public.user_profiles(user_id, username) values ($1, $2)', [userId, username]);
      await db.query('insert into public.perfiles_publicos(user_id, display_name) values ($1, $2)', [userId, username]);
      await db.query("insert into public.minifiguras(user_id, id, nombre, categoria) values ($1, 'A-1', 'Astronauta', 'Space')", [userId]);
      await db.query('insert into public.gamificacion(user_id) values ($1)', [userId]);
      await db.query("insert into public.user_profile_favorite_categories(user_id, category_name) values ($1, 'Space')", [userId]);
    }
    await db.query('insert into public.friend_requests(sender_id, recipient_id, status) values ($1, $2, $3)', [userA, userB, 'accepted']);
    await db.query('insert into public.friendships(user_low_id, user_high_id) values ($1, $2)', [userA, userB]);
    const survivorAchievements = [
      { id: 'block-by-block', nombre: 'Block by block', bricks: 1, repetible: true, cantidad: 1, total: 1 },
      { id: 'handshake', nombre: 'Handshake', bricks: 3, repetible: false, cantidad: 1, total: 3 },
    ];
    await db.query('update public.gamificacion set bricks = 4, logros = $2::jsonb where user_id = $1', [userB, JSON.stringify(survivorAchievements)]);
    await db.exec('set role anon');
    await assert.rejects(db.query('select public.eliminar_cuenta_usuario()'), /permission denied/);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userA]);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select public.eliminar_cuenta_usuario()'), /NO_AUTENTICADO/);
    await db.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
    await assert.rejects(db.query('delete from auth.users where id = $1', [userB]), /permission denied/);
    await db.exec('reset role');
    await db.exec(`
      create function private.test_refuse_deletion() returns trigger language plpgsql as $$
      begin raise exception 'SIMULATED_FAILURE'; end; $$;
      create trigger zz_test_refuse_deletion after delete on auth.users
      for each row execute function private.test_refuse_deletion();
    `);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select public.eliminar_cuenta_usuario()'), /SIMULATED_FAILURE/);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::integer as total from auth.users')).rows[0].total, 2);
    assert.equal((await db.query('select count(*)::integer as total from public.minifiguras')).rows[0].total, 2);
    assert.deepEqual((await db.query('select logros from public.gamificacion where user_id = $1', [userB])).rows[0].logros, survivorAchievements);
    await db.exec('drop trigger zz_test_refuse_deletion on auth.users');
    await db.exec('set role authenticated');
    await db.query('select public.eliminar_cuenta_usuario()');
    await db.exec('reset role');
    assert.deepEqual((await db.query('select id from auth.users')).rows, [{ id: userB }]);
    for (const table of ['user_profiles', 'perfiles_publicos', 'minifiguras', 'gamificacion', 'user_profile_favorite_categories']) {
      assert.equal((await db.query(`select count(*)::integer as total from public.${table} where user_id = $1`, [userA])).rows[0].total, 0);
      assert.equal((await db.query(`select count(*)::integer as total from public.${table} where user_id = $1`, [userB])).rows[0].total, 1);
    }
    const survivorState = (await db.query('select bricks, logros from public.gamificacion where user_id = $1', [userB])).rows[0];
    assert.equal(survivorState.bricks, 1);
    assert.deepEqual(survivorState.logros, [survivorAchievements[0]]);
    assert.equal((await db.query('select count(*)::integer as total from public.friendships')).rows[0].total, 0);
    assert.equal((await db.query('select count(*)::integer as total from public.friend_requests')).rows[0].total, 0);
  } finally {
    await db.close();
  }
});

test('schema amplía la constraint heredada de DNA antes de insertar un logro V2 sin ponderación', async () => {
  const db = new PGlite();
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
      create table public.dna_ponderaciones (
        logro_id text primary key,
        rarity_hunter smallint not null,
        collector smallint not null,
        explorer smallint not null,
        fan smallint not null,
        constraint dna_ponderaciones_suma_check check (
          (logro_id = 'someone-liked-your-collection' and rarity_hunter = 0 and collector = 0 and explorer = 0 and fan = 0)
          or (logro_id <> 'someone-liked-your-collection' and rarity_hunter + collector + explorer + fan = 100)
        )
      );
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    assert.deepEqual((await db.query("select rarity_hunter, collector, explorer, fan from public.dna_ponderaciones where logro_id = 'curiosity-driven'")).rows[0], {
      rarity_hunter: 0, collector: 0, explorer: 0, fan: 0,
    });
  } finally {
    await db.close();
  }
});

test('el helper privado reconstruye estado social V2 con paridad, idempotencia y permisos cerrados', async () => {
  const db = new PGlite();
  const senderId = '00000000-0000-4000-8000-0000000000a1';
  const recipientId = '00000000-0000-4000-8000-0000000000b1';
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
    await db.query('insert into auth.users(id) values ($1), ($2)', [senderId, recipientId]);
    await db.query('insert into public.friend_requests(sender_id, recipient_id, status) values ($1, $2, $3)', [senderId, recipientId, 'pending']);

    assert.equal((await db.query("select has_function_privilege('anon', 'private.gamificacion_reconstruir_social(uuid[])', 'EXECUTE') as allowed")).rows[0].allowed, false);
    assert.equal((await db.query("select has_function_privilege('authenticated', 'private.gamificacion_reconstruir_social(uuid[])', 'EXECUTE') as allowed")).rows[0].allowed, false);
    await db.query('select private.gamificacion_reconstruir_social(array[$1::uuid, $2::uuid])', [recipientId, senderId]);

    const stored = (await db.query('select bricks, nivel, siguiente_nivel, progreso, logros from public.gamificacion where user_id = $1', [senderId])).rows[0];
    const expected = calcularGamificacion([], [], 0, 0, 0, {
      friends: 0, sent_pending: 1, accepted_sent: 0, accepted_received: 0,
      global_gifts_received: 0, weekly_gifts_received: 0, thanks_sent: 0, thanks_received: 0,
    });
    assert.equal(stored.bricks, expected.bricks);
    assert.deepEqual(stored.nivel, expected.nivel);
    assert.deepEqual(stored.siguiente_nivel, expected.siguienteNivel);
    assert.deepEqual(stored.progreso, expected.progreso);
    assert.deepEqual(stored.logros, expected.logros);

    const beforeRetry = (await db.query('select to_jsonb(state) as row from public.gamificacion state where user_id = $1', [senderId])).rows[0].row;
    await db.query('select private.gamificacion_reconstruir_social(array[$1::uuid, $2::uuid])', [senderId, recipientId]);
    const afterRetry = (await db.query('select to_jsonb(state) as row from public.gamificacion state where user_id = $1', [senderId])).rows[0].row;
    assert.deepEqual(afterRetry, beforeRetry);
  } finally {
    await db.close();
  }
});

test('el helper V2 aplica y retira hitos de amistades en 10, 20, 50 y 100', async () => {
  const db = new PGlite();
  const targetId = '15000000-0000-4000-8000-000000000001';
  const friendId = (ordinal) => `15000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`;
  const addFriends = async (start, count) => db.query(`
    insert into public.friendships(user_low_id, user_high_id)
    select $1::uuid, ('15000000-0000-4000-8000-' || lpad(ordinal::text, 12, '0'))::uuid
    from generate_series($2::integer, ($2 + $3 - 1)::integer) ordinal
  `, [targetId, start, count]);
  const rebuild = () => db.query('select private.gamificacion_reconstruir_social(array[$1::uuid])', [targetId]);
  const state = async () => (await db.query('select bricks, logros from public.gamificacion where user_id = $1', [targetId])).rows[0];
  const earnedIds = async () => (await state()).logros.map(({ id }) => id);
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create function auth.role() returns text language sql as $$ select 'postgres'::text $$;
      create table auth.users(id uuid primary key);
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query(`insert into auth.users(id) select ('15000000-0000-4000-8000-' || lpad(ordinal::text, 12, '0'))::uuid
      from generate_series(1, 101) ordinal`);
    await addFriends(2, 10);
    await rebuild();
    assert.deepEqual((await earnedIds()).filter((id) => ['crew', 'brick-alliance', 'full-house', 'community'].includes(id)), ['crew']);
    assert.equal((await state()).bricks, 20);

    await addFriends(12, 10);
    await rebuild();
    assert.deepEqual((await earnedIds()).filter((id) => ['crew', 'brick-alliance', 'full-house', 'community'].includes(id)), ['crew', 'brick-alliance']);
    assert.equal((await state()).bricks, 60);

    await addFriends(22, 30);
    await rebuild();
    assert.deepEqual((await earnedIds()).filter((id) => ['crew', 'brick-alliance', 'full-house', 'community'].includes(id)), ['crew', 'brick-alliance', 'full-house']);
    assert.equal((await state()).bricks, 160);

    await addFriends(52, 50);
    await rebuild();
    assert.deepEqual((await earnedIds()).filter((id) => ['crew', 'brick-alliance', 'full-house', 'community'].includes(id)), ['crew', 'brick-alliance', 'full-house', 'community']);
    assert.equal((await state()).bricks, 460);

    await db.query('delete from public.friendships where user_low_id = $1 and user_high_id = $2', [targetId, friendId(101)]);
    await rebuild();
    assert.equal((await earnedIds()).includes('community'), false);
    assert.equal((await state()).bricks, 160);
  } finally {
    await db.close();
  }
});

test('schema persiste perfiles y favoritos con unicidad, RLS y borrado en cascada', async () => {
  const db = new PGlite();
  const userA = '00000000-0000-4000-8000-0000000000a1';
  const userB = '00000000-0000-4000-8000-0000000000b1';
  const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
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
    await db.exec(schema);
    await db.exec(schema);
    await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4)', [
      userA, 'profile-a@example.invalid', userB, 'profile-b@example.invalid',
    ]);
    await db.query('insert into public.user_profiles(user_id, username, onboarding_completed) values ($1, $2, true), ($3, $4, true)', [
      userA, 'Collector_1', userB, 'OtherUser',
    ]);
    await db.query('insert into public.user_profile_favorite_categories(user_id, category_name) values ($1, $2)', [userA, 'Space']);

    await assert.rejects(
      db.query('insert into public.user_profiles(user_id, username) values ($1, $2)', [userB, 'collector_1']),
      /duplicate key value violates unique constraint/,
    );
    await assert.rejects(
      db.query('insert into public.user_profiles(user_id, username) values ($1, $2)', [userB, 'bad name']),
      /user_profiles_username_check/,
    );
    assert.equal((await db.query("select has_table_privilege('anon', 'public.user_profiles', 'SELECT') as allowed")).rows[0].allowed, false);

    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userA]);
    await db.exec('set role authenticated');
    assert.deepEqual((await db.query('select username from public.user_profiles')).rows, [{ username: 'Collector_1' }]);
    assert.equal((await db.query('select category_name from public.user_profile_favorite_categories')).rows[0].category_name, 'Space');
    assert.equal((await db.query('update public.user_profiles set username = $1 where user_id = $2 returning user_id', ['Hijack', userB])).rows.length, 0);
    await assert.rejects(
      db.query('insert into public.user_profile_favorite_categories(user_id, category_name) values ($1, $2)', [userB, 'Castle']),
      /row-level security/,
    );
    await db.exec('reset role');

    await db.query('delete from auth.users where id = $1', [userA]);
    assert.equal((await db.query('select count(*)::integer as total from public.user_profiles where user_id = $1', [userA])).rows[0].total, 0);
    assert.equal((await db.query('select count(*)::integer as total from public.user_profile_favorite_categories where user_id = $1', [userA])).rows[0].total, 0);
  } finally {
    await db.close();
  }
});

test('guardar_perfil_usuario aplica preferencias con JWT, username inmutable y rollback atomico', async () => {
  const db = new PGlite();
  const userId = '00000000-0000-4000-8000-0000000000c1';
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      grant usage on schema auth to authenticated;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (id uuid primary key, email text unique);
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id, email) values ($1, $2)', [userId, 'profile-rpc@example.invalid']);
    await db.query('insert into public.user_profiles(user_id, username) values ($1, $2)', [userId, 'Collector_1']);
    await db.query('insert into public.user_profile_favorite_categories(user_id, category_name) values ($1, $2)', [userId, 'Space']);
    await db.query('insert into public.perfiles_publicos(user_id, display_name, avatar_url) values ($1, $2, $3)', [userId, 'Ada', 'https://google.example/avatar.png']);

    assert.equal((await db.query("select has_function_privilege('anon', 'public.guardar_perfil_usuario(text,text,text,text,text[])', 'EXECUTE') as allowed")).rows[0].allowed, false);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    await db.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
    await db.exec('set role authenticated');
    await db.query('select public.guardar_perfil_usuario($1, $2, $3, $4, $5)', [
      'Collector_1', 'https://custom.example/avatar.png', 'EUR', 'es', ['Castle', 'Space'],
    ]);

    assert.deepEqual((await db.query('select username, avatar_url, currency, language, onboarding_completed from public.user_profiles')).rows[0], {
      username: 'Collector_1', avatar_url: 'https://custom.example/avatar.png', currency: 'EUR', language: 'es', onboarding_completed: true,
    });
    assert.deepEqual((await db.query('select category_name from public.user_profile_favorite_categories order by category_name')).rows, [
      { category_name: 'Castle' }, { category_name: 'Space' },
    ]);
    assert.equal((await db.query('select display_name, avatar_url from public.perfiles_publicos')).rows[0].avatar_url, 'https://custom.example/avatar.png');
    await assert.rejects(db.query('select public.guardar_perfil_usuario($1, $2, $3, $4, $5)', [
      'Collector_1', null, 'EUR', 'es', ['Castle', 'Space', 'City', 'Star Wars'],
    ]), /PERFIL_INVALIDO/);
    await db.query('insert into public.user_profile_favorite_categories(user_id, category_name) values ($1, $2)', [userId, 'City']);
    await db.query('update public.user_profile_favorite_categories set category_name = $2 where user_id = $1 and category_name = $3', [userId, 'Town', 'City']);
    await db.query('update public.user_profile_favorite_categories set category_name = $2 where user_id = $1 and category_name = $3', [userId, 'City', 'Town']);
    await assert.rejects(db.query('insert into public.user_profile_favorite_categories(user_id, category_name) values ($1, $2)', [userId, 'Star Wars']), /LIMITE_CATEGORIAS_FAVORITAS/);
    await db.query('delete from public.user_profile_favorite_categories where user_id = $1 and category_name = $2', [userId, 'City']);
    await assert.rejects(
      db.query('select public.guardar_perfil_usuario($1, $2, $3, $4, $5)', ['ChangedName', null, 'EUR', 'es', []]),
      /USERNAME_INMUTABLE/,
    );
    await assert.rejects(
      db.query('update public.user_profiles set username = $1', ['ChangedName']),
      /USERNAME_INMUTABLE/,
    );

    await db.exec('reset role');
    await db.exec('revoke update on table public.perfiles_publicos from authenticated');
    await db.exec('set role authenticated');
    await assert.rejects(
      db.query('select public.guardar_perfil_usuario($1, $2, $3, $4, $5)', [
        'Collector_1', 'https://changed.example/avatar.png', 'EUR', 'es', ['Pirates'],
      ]),
      /permission denied/,
    );
    await db.exec('reset role');
    assert.equal((await db.query('select avatar_url from public.user_profiles where user_id = $1', [userId])).rows[0].avatar_url, 'https://custom.example/avatar.png');
    assert.deepEqual((await db.query('select category_name from public.user_profile_favorite_categories order by category_name')).rows, [
      { category_name: 'Castle' }, { category_name: 'Space' },
    ]);
  } finally {
    await db.close();
  }
});

test('reaplicar schema no instala ni recrea recompensas V1 de agradecimiento', async () => {
  const db = new PGlite();
  const userId = '00000000-0000-4000-8000-0000000000d1';
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
    const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
    await db.exec(schema);
    await db.query('insert into auth.users(id, email) values ($1, $2)', [userId, 'v2@example.invalid']);
    const v2Achievement = {
      id: 'gratitude-is-the-sign-of-noble-souls', type: 'regalo',
      nombre: 'Gratitude is the sign of noble souls', descripcion: 'Has dado las gracias por primera vez',
      bricks: 5, repetible: false, cantidad: 1, total: 5,
    };
    await db.query(`insert into public.gamificacion(user_id, bricks, nivel, siguiente_nivel, progreso, logros)
      values ($1, 5, '{"id":0,"nombre":"Duplo"}', '{"id":1,"nombre":"Stud"}', '{"actual":5,"desde":0,"hasta":20,"porcentaje":25}', $2::jsonb)`, [
      userId, JSON.stringify([v2Achievement]),
    ]);
    await db.exec(schema);
    const state = (await db.query('select bricks, logros from public.gamificacion where user_id = $1', [userId])).rows[0];
    assert.equal(state.bricks, 5);
    assert.deepEqual(state.logros, [v2Achievement]);
    assert.equal((await db.query("select to_regclass('private.thanks_reward_ownership_migration') is null as missing")).rows[0].missing, true);
    assert.equal((await db.query("select to_regprocedure('private.migrar_propiedad_logro_agradecimiento()') is null as missing")).rows[0].missing, true);
    assert.equal(state.logros.some(({ id }) => id === 'thanks-for-the-gift'), false);
  } finally {
    await db.close();
  }
});

test('reset de miniPeopleDB_prueba vacía todas las tablas de datos de aplicación y Auth', async () => {
  const db = new PGlite();
  const resetSql = await readFile(new URL('../supabase/reset-miniPeopleDB-prueba.sql', import.meta.url), 'utf8');
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create role reset_runner;
      create role supabase_auth_admin;
      grant usage, create on schema auth to reset_runner, supabase_auth_admin;
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
      alter table auth.users owner to reset_runner;
      grant references on auth.users to supabase_auth_admin;
    `);
    await db.exec(`
      set role supabase_auth_admin;
      create table auth.refresh_tokens (
        id bigserial primary key,
        user_id uuid references auth.users(id) on delete cascade
      );
      reset role;
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/insert-miniPeopleDB-prueba.sql', import.meta.url), 'utf8'));
    await db.exec(`
      insert into public.friend_requests(sender_id, recipient_id, status)
      values ('13000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000002', 'pending');
      insert into public.friendships(user_low_id, user_high_id)
      values ('13000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000002');
    `);
    assert.equal((await db.query(`
      select count(*)::integer as total
      from public.user_profiles profiles
      join auth.users users on users.id = profiles.user_id
      where users.raw_user_meta_data->>'minipeopledb_seed' = 'lego-13-prueba-v1'
        and profiles.onboarding_completed
    `)).rows[0].total, 20);
    await db.query('insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3)', [
      '00000000-0000-4000-8000-0000000000e1', 'outside@example.invalid', '{}',
    ]);
    await db.query('insert into auth.refresh_tokens(user_id) select id from auth.users limit 1');
    await db.exec(`
      grant usage on schema public, private to reset_runner;
      grant select on auth.users to reset_runner;
      grant truncate on auth.refresh_tokens to reset_runner;
      grant truncate on all tables in schema public to reset_runner;
      grant truncate on all tables in schema private to reset_runner;
      set role reset_runner;
    `);
    await db.exec(resetSql);
    await db.exec('reset role');

    for (const table of [
      'auth.users', 'auth.refresh_tokens', 'public.minifiguras', 'public.gamificacion', 'public.user_daily_snapshots',
      'public.gamificacion_categoria_version', 'public.dna_ponderaciones', 'public.regalos_enviados',
      'public.notificaciones', 'public.agradecimientos_regalo', 'public.ranking_top10_membership',
      'public.user_profiles', 'public.user_profile_favorite_categories', 'public.perfiles_publicos',
      'private.daily_sync_users', 'private.daily_sync_prices',
      'private.daily_sync_runs', 'private.daily_sync_figure_prices',
      'private.ranking_top10_reconciliation_state',
    ]) {
      assert.equal((await db.query(`select count(*)::integer as total from ${table}`)).rows[0].total, 0, table);
    }
  } finally {
    await db.close();
  }
});

test('getSupabaseConfig devuelve null sin variables ni sup.env', () => {
  assert.equal(getSupabaseConfig({ env: {}, envPath: join(tmpdir(), 'no-existe-sup.env') }), null);
  assert.equal(getSupabaseAdminConfig({ env: {}, envPath: join(tmpdir(), 'no-existe-sup.env') }), null);
});

test('getSupabaseConfig prioriza variables de entorno y usa sup.env como alternativa', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'supabase-config-'));
  const envPath = join(directory, 'sup.env');
  await writeFile(envPath, '# comentario\nSUPABASE_URL=https://file.supabase.co\nSUPABASE_ANON_KEY=file-key\n');
    await writeFile(envPath, '# comentario\nSUPABASE_URL=https://file.supabase.co\nSUPABASE_ANON_KEY=file-key\nSUPABASE_SERVICE_ROLE_KEY=server-key\n');
  await writeFile(envPath, '# comentario\nSUPABASE_URL=https://file.supabase.co\nSUPABASE_ANON_KEY=file-key\nSUPABASE_SERVICE_ROLE_KEY=server-key\n');
  try {
    assert.deepEqual(getSupabaseConfig({ env: {}, envPath }), { url: 'https://file.supabase.co', anonKey: 'file-key' });
    assert.deepEqual(
      getSupabaseConfig({ env: { SUPABASE_URL: 'https://env.supabase.co', SUPABASE_ANON_KEY: 'env-key' }, envPath }),
      { url: 'https://env.supabase.co', anonKey: 'env-key' },
    );
    assert.deepEqual(getSupabaseAdminConfig({ env: {}, envPath }), { url: 'https://file.supabase.co', serviceRoleKey: 'server-key' });
    assert.deepEqual(
      getSupabaseAdminConfig({ env: { SUPABASE_URL: 'https://env.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'env-server-key' }, envPath }),
      { url: 'https://env.supabase.co', serviceRoleKey: 'env-server-key' },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('getCronSecret prioriza entorno y usa archivo backend sin revelar valores reales', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cron-secret-config-'));
  const envPath = join(directory, 'sup.env');
  await writeFile(envPath, 'CRON_SECRET=file-secret-for-test\n');
  try {
    assert.equal(getCronSecret({ env: {}, envPath }), 'file-secret-for-test');
    assert.equal(getCronSecret({ env: { CRON_SECRET: 'env-secret-for-test' }, envPath }), 'env-secret-for-test');
    assert.equal(getCronSecret({ env: {}, envPath: join(directory, 'missing.env') }), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('el mock de Supabase aísla filas por usuario, detecta duplicados e inyecta fallos', async () => {
  const mock = createSupabaseMock({ users: { 'token-a': { id: 'user-a' }, 'token-b': { id: 'user-b' } } });
  const clientA = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-a' } } });
  const clientB = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-b' } } });
  const anonymous = mock.createClient('url', 'key');

  assert.equal((await clientA.auth.getUser('token-a')).data.user.id, 'user-a');
  assert.ok((await clientA.auth.getUser('otro')).error);

  assert.equal((await clientA.from('minifiguras').insert({ id: 'X', nombre: 'A', categoria: 'Space' })).error, null);
  assert.equal((await clientB.from('minifiguras').insert({ id: 'X', nombre: 'B', categoria: 'Space' })).error, null);
  assert.equal((await clientA.from('minifiguras').insert({ id: 'X', nombre: 'A2', categoria: 'Space' })).error.code, '23505');
  assert.equal((await anonymous.from('minifiguras').insert({ id: 'Y', nombre: 'N', categoria: 'Space' })).error.code, '42501');

  const { data } = await clientA.from('minifiguras').select('*');
  assert.deepEqual(data.map(({ nombre }) => nombre), ['A']);

  const updated = await clientA.from('minifiguras').update({ nombre: 'A3' }).eq('id', 'X').select('id');
  assert.equal(updated.data.length, 1);
  assert.equal(mock.rows('minifiguras', 'user-b')[0].nombre, 'B');

  mock.failNext('minifiguras');
  assert.ok((await clientA.from('minifiguras').select('*')).error);
  assert.equal((await clientA.from('minifiguras').select('*')).error, null);
});

test('el mock guarda perfiles y favoritos aislados y revierte fallos de la proyeccion publica', async () => {
  const mock = createSupabaseMock({ users: { 'token-a': { id: 'user-a' }, 'token-b': { id: 'user-b' } } });
  const clientA = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-a' } } });
  const clientB = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-b' } } });
  mock.seed('user_profiles', 'user-b', [{ username: 'BrickFan', onboarding_completed: true }]);
  const profile = {
    p_username: 'SpaceFan',
    p_avatar_url: 'https://example.invalid/avatar.png',
    p_currency: 'EUR',
    p_language: 'es',
    p_favorite_categories: ['Space', 'Castle'],
  };

  assert.equal((await clientA.rpc('guardar_perfil_usuario', profile)).error, null);
  assert.equal(mock.rows('user_profiles', 'user-a')[0].username, 'SpaceFan');
  assert.equal(mock.rows('user_profiles', 'user-a')[0].onboarding_completed, true);
  assert.deepEqual(mock.rows('user_profile_favorite_categories', 'user-a').map(({ category_name }) => category_name), ['Space', 'Castle']);
  assert.equal(mock.rows('perfiles_publicos', 'user-a')[0].avatar_url, profile.p_avatar_url);
  assert.deepEqual((await clientB.from('user_profiles').select('*')).data.map(({ username }) => username), ['BrickFan']);

  assert.equal((await clientA.rpc('guardar_perfil_usuario', { ...profile, p_username: 'brickfan' })).error.code, '23505');
  assert.equal((await clientA.rpc('guardar_perfil_usuario', { ...profile, p_username: 'OtherName' })).error.message, 'USERNAME_INMUTABLE');
  mock.failNext('perfiles_publicos', { code: 'PGRST000', message: 'connection refused' }, 'upsert');
  const failed = await clientA.rpc('guardar_perfil_usuario', { ...profile, p_avatar_url: 'https://example.invalid/new.png', p_favorite_categories: ['Pirates'] });
  assert.equal(failed.error.message, 'connection refused');
  assert.equal(mock.rows('user_profiles', 'user-a')[0].avatar_url, profile.p_avatar_url);
  assert.deepEqual(mock.rows('user_profile_favorite_categories', 'user-a').map(({ category_name }) => category_name), ['Space', 'Castle']);
  assert.equal(mock.rows('perfiles_publicos', 'user-a')[0].avatar_url, profile.p_avatar_url);
});

test('el mock protege perfiles y expone solo la proyección global mediante RPC', async () => {
  const mock = createSupabaseMock({ users: { 'token-a': { id: 'user-a' }, 'token-b': { id: 'user-b' } } });
  const clientA = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-a' } } });
  const clientB = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-b' } } });
  await clientA.from('perfiles_publicos').upsert({ user_id: 'user-a', display_name: 'Ada', avatar_url: 'https://example.com/a.png' });
  assert.equal((await clientA.from('perfiles_publicos').upsert({ user_id: 'user-b', display_name: 'Intruso' })).error.code, '42501');
  assert.deepEqual((await clientB.from('perfiles_publicos').select('*')).data, []);

  mock.seed('gamificacion', 'user-a', [{ bricks: 100, nivel: { id: 3, nombre: 'Three-Seven-Five' } }]);
  mock.seed('minifiguras', 'user-a', [
    { id: 'OLD', nombre: 'Old', estado_coleccion: 'COLECCIÓN', anio: 1980, precio: 5 },
    { id: 'HIGH', nombre: 'High', estado_coleccion: 'COLECCIÓN', anio: 2020, precio: 50, categoria: 'Space', subcategoria: 'Classic', descripcion: 'privada', precio_compra: 1 },
    { id: 'WANTED', nombre: 'Wanted', estado_coleccion: 'BUSCADA', anio: 1970, precio: 100 },
  ]);
  const ranking = (await clientB.rpc('ranking_global')).data;
  assert.deepEqual((await clientA.rpc('gamificacion_dna')).data, {
    principal: 'Newbie', porcentajes: { rarityHunter: 0, collector: 0, explorer: 0, fan: 0 },
  });
  assert.equal((await mock.createClient('url', 'key').rpc('gamificacion_dna')).error.code, '42501');
  assert.deepEqual(Object.keys(ranking[0]).sort(), [
    'avatar_url', 'bricks', 'display_name', 'dna_principal', 'dna_rasgos', 'imagen_nivel', 'nivel', 'nombre_nivel', 'regalo_enviado',
    'top5_antiguedad', 'top5_precio', 'total_coleccion', 'user_id',
  ]);
  assert.equal(ranking[0].dna_principal, 'Newbie');
  assert.equal(ranking[0].total_coleccion, 2);
  assert.deepEqual(ranking[0].top5_precio.map(({ id }) => id), ['HIGH', 'OLD']);
  assert.deepEqual(ranking[0].top5_antiguedad.map(({ id }) => id), ['OLD', 'HIGH']);
  const expected = { id: 'HIGH', nombre: 'High', precio: 50, anio: 2020, categoria: 'Space', subcategoria: 'Classic' };
  assert.deepEqual(ranking[0].top5_precio[0], expected);
  assert.deepEqual(ranking[0].top5_antiguedad[1], expected);
});

test('el ranking limita a diez y desempata por user_id', async () => {
  const users = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`token-${index}`, { id: `user-${String(index).padStart(2, '0')}` }]));
  const mock = createSupabaseMock({ users });
  for (let index = 11; index >= 0; index -= 1) {
    mock.seed('gamificacion', `user-${String(index).padStart(2, '0')}`, [{ bricks: 100, nivel: { id: 3, nombre: 'Three-Seven-Five' } }]);
  }
  const client = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-0' } } });
  const ranking = (await client.rpc('ranking_global')).data;
  assert.equal(ranking.length, 10);
  assert.deepEqual(ranking.map(({ user_id }) => user_id), Array.from({ length: 10 }, (_, index) => `user-${String(index).padStart(2, '0')}`));
});

test('ranking_logros proyecta solo datos publicos del Top 10 sin escrituras ni abrir RLS', async () => {
  const mock = createSupabaseMock({ users: { token: { id: 'viewer' } } });
  for (let index = 11; index >= 0; index -= 1) {
    mock.seed('gamificacion', `user-${String(index).padStart(2, '0')}`, [{ bricks: 100,
      nivel: { id: 3, nombre: 'Nivel', privado: 'secret' },
      logros: [{ id: 'logro', nombre: 'Logro', bricks: 10, repetible: false, cantidad: 1, total: 10, donante: 'secret' }],
    }]);
  }
  mock.seed('perfiles_publicos', 'user-00', [{ display_name: 'Nombre Google antiguo', email: 'privado' }]);
  mock.seed('user_profiles', 'user-00', [{ username: 'Ada' }]);
  const before = mock.rows('gamificacion');
  const client = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token' } } });
  const result = await client.rpc('ranking_logros', { p_usuario_id: 'user-00' });
  assert.equal(result.error, null);
  assert.deepEqual(result.data, { userId: 'user-00', displayName: 'Ada', bricks: 100,
    nivel: { id: 3, nombre: 'Nivel' }, logros: [{ id: 'logro', nombre: 'Logro', bricks: 10, repetible: false, cantidad: 1, total: 10, destacado: false }] });
  assert.equal((await client.rpc('ranking_logros', { p_usuario_id: 'user-09' })).data.userId, 'user-09');
  assert.equal((await client.rpc('ranking_logros', { p_usuario_id: 'user-10' })).data, null);
  assert.equal((await client.rpc('ranking_logros', { p_usuario_id: 'missing' })).data, null);
  assert.deepEqual((await client.from('gamificacion').select('*')).data, []);
  assert.deepEqual((await client.from('user_profiles').select('*')).data, []);
  assert.equal((await mock.createClient('url', 'key').rpc('ranking_logros', { p_usuario_id: 'user-00' })).error.code, '42501');
  assert.deepEqual(mock.rows('gamificacion'), before);
  assert.deepEqual(mock.rows('minifiguras'), []);
  assert.deepEqual(mock.rows('regalos_enviados'), []);
});

test('el mock social deriva identidad del JWT, limita lecturas y revierte aceptación fallida', async () => {
  const mock = createSupabaseMock({ users: {
    'token-a': { id: 'user-a' }, 'token-b': { id: 'user-b' }, 'token-c': { id: 'user-c' }, 'token-stranger': { id: 'stranger' },
  } });
  const clientA = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-a' } } });
  const clientB = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-b' } } });
  const clientC = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-c' } } });
  const stranger = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-stranger' } } });
  mock.seed('user_profiles', 'user-a', [{ username: 'SpaceFan' }]);
  mock.seed('user_profiles', 'user-b', [{ username: 'BrickFan' }]);
  mock.seed('user_profiles', 'user-c', [{ username: 'CastleFan' }]);
  mock.seed('gamificacion', 'user-b', [{ bricks: 30, nivel: { id: 2, nombre: 'Level' }, logros: [] }]);
  mock.seed('gamificacion', 'user-c', [{ bricks: 20, nivel: { id: 1, nombre: 'Level' }, logros: [] }]);
  mock.seed('minifiguras', 'user-b', [{ id: 'A-1', nombre: 'Private figure', estado_coleccion: 'COLECCIÓN', fecha_registro: '2026-01-01T00:00:00.000Z' }]);

  const search = await clientA.rpc('amigos_buscar', { p_query: 'fAn' });
  assert.deepEqual(search.data.map(({ user_id, relationship_status }) => ({ user_id, relationship_status })), [
    { user_id: 'user-b', relationship_status: 'none' },
    { user_id: 'user-c', relationship_status: 'none' },
  ]);
  assert.equal('email' in search.data[0], false);
  assert.equal((await clientA.from('friend_requests').insert({ sender_id: 'user-a', recipient_id: 'user-b' })).error.code, '42501');
  assert.deepEqual((await stranger.from('friend_requests').select('*')).data, []);

  const sent = await clientA.rpc('amigos_enviar', { p_receptor_id: 'user-b' });
  assert.equal(sent.error, null);
  const requestId = sent.data.requestId;
  assert.equal(mock.rows('notificaciones', 'user-b')[0].type, 'friend_request');
  assert.equal((await clientA.rpc('amigos_enviar', { p_receptor_id: 'user-b' })).error.message, 'SOLICITUD_EXISTENTE');
  assert.equal((await clientB.rpc('amigos_rechazar', { p_solicitud_id: requestId })).data.status, 'rejected');
  assert.deepEqual((await clientB.rpc('amigos_listar', { p_tipo: 'received' })).data.map(({ status }) => status), ['rejected']);
  assert.equal((await clientB.rpc('amigos_aceptar', { p_solicitud_id: requestId })).data.status, 'accepted');
  assert.equal((await clientA.rpc('amigos_listar', { p_tipo: 'friends' })).data[0].user_id, 'user-b');
  assert.equal((await clientA.rpc('amigos_aceptar', { p_solicitud_id: requestId })).error.message, 'SOLICITUD_NO_ENCONTRADA');

  const secondRequest = await clientC.rpc('amigos_enviar', { p_receptor_id: 'user-b' });
  mock.failNext('notificaciones', { code: 'XX000', message: 'notification unavailable' }, 'insert');
  assert.equal((await clientB.rpc('amigos_aceptar', { p_solicitud_id: secondRequest.data.requestId })).error.message, 'notification unavailable');
  assert.equal(mock.rows('friend_requests').find(({ id }) => id === secondRequest.data.requestId).status, 'pending');
  assert.equal(mock.rows('friendships').some(({ user_low_id, user_high_id }) => user_low_id === 'user-b' && user_high_id === 'user-c'), false);
  assert.equal((await clientB.rpc('amigos_aceptar', { p_solicitud_id: secondRequest.data.requestId })).error, null);
  assert.equal(mock.rows('friendships').filter(({ user_low_id, user_high_id }) => user_low_id === 'user-b' && user_high_id === 'user-c').length, 1);
  assert.equal(mock.rows('notificaciones', 'user-c').filter(({ type }) => type === 'friend_request_accepted').length, 1);
  assert.deepEqual((await stranger.from('friendships').select('*')).data, []);
});

test('el mock recalcula al superviviente al eliminar una cuenta y preserva logros de colección', async () => {
  const mock = createSupabaseMock({ users: {
    'token-deleted': { id: 'deleted-user' }, 'token-survivor': { id: 'survivor-user' },
  } });
  const deletedClient = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-deleted' } } });
  mock.seed('friend_requests', undefined, [{
    id: 'accepted-request', sender_id: 'deleted-user', recipient_id: 'survivor-user', status: 'accepted',
  }]);
  mock.seed('friendships', undefined, [{ user_low_id: 'deleted-user', user_high_id: 'survivor-user' }]);
  mock.seed('gamificacion', 'survivor-user', [{
    bricks: 4,
    nivel: { id: 0, nombre: 'Duplo' },
    logros: [
      { id: 'block-by-block', nombre: 'Block by block', bricks: 1, repetible: true, cantidad: 1, total: 1 },
      { id: 'handshake', nombre: 'Handshake', bricks: 3, repetible: false, cantidad: 1, total: 3 },
    ],
  }]);

  assert.equal((await deletedClient.rpc('eliminar_cuenta_usuario')).error, null);
  const survivor = mock.rows('gamificacion', 'survivor-user')[0];
  assert.equal(survivor.bricks, 1);
  assert.deepEqual(survivor.logros.map(({ id }) => id), ['block-by-block']);
  assert.deepEqual(mock.rows('friendships'), []);
  assert.deepEqual(mock.rows('friend_requests'), []);
});

test('el mock aplica regalos únicos y revierte la transacción si falla gamificación', async () => {
  const mock = createSupabaseMock({ users: {
    'token-a': { id: 'user-a' }, 'token-b': { id: 'user-b' }, 'token-c': { id: 'user-c' },
  } });
  const clientA = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-a' } } });
  const clientC = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-c' } } });
  mock.seed('gamificacion', 'user-b', [{ bricks: 10, nivel: { id: 0, nombre: 'Duplo' }, logros: [] }]);

  assert.equal((await clientA.rpc('regalar_bricks', { p_receptor_id: 'user-a' })).error.message, 'AUTORREGALO_NO_PERMITIDO');
  assert.equal((await clientA.rpc('regalar_bricks', { p_receptor_id: 'missing' })).error.message, 'RECEPTOR_NO_ENCONTRADO');
  assert.deepEqual((await clientA.rpc('regalar_bricks', { p_receptor_id: 'user-b' })).data, { ok: true });
  assert.equal(mock.rows('gamificacion', 'user-b')[0].bricks, 70);
  assert.equal(mock.rows('gamificacion', 'user-b')[0].logros[0].type, 'regalo');
  assert.equal((await clientA.rpc('regalar_bricks', { p_receptor_id: 'user-b' })).error.message, 'REGALO_YA_ENVIADO');

  mock.failNext('gamificacion', { code: 'PGRST000', message: 'fallo' }, 'update');
  assert.ok((await clientC.rpc('regalar_bricks', { p_receptor_id: 'user-b' })).error);
  assert.equal(mock.rows('gamificacion', 'user-b')[0].bricks, 70);
  assert.equal(mock.rows('regalos_enviados').length, 1);
});

test('el mock aísla la bandeja y procesa agradecimientos con recompensa única y atómica', async () => {
  const mock = createSupabaseMock({ users: {
    'token-sender': { id: 'sender' }, 'token-receiver': { id: 'receiver' }, 'token-other': { id: 'other' },
  } });
  const sender = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-sender' } } });
  const receiver = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-receiver' } } });
  mock.seed('gamificacion', 'sender', [{ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, logros: [] }]);
  mock.seed('gamificacion', 'receiver', [{ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, logros: [] }]);
  mock.seed('perfiles_publicos', 'sender', [{ display_name: 'Google Ada' }]);
  mock.seed('perfiles_publicos', 'receiver', [{ display_name: 'Google Grace' }]);
  mock.seed('user_profiles', 'sender', [{ username: 'AdaCollector' }]);
  mock.seed('user_profiles', 'receiver', [{ username: 'GraceCollector' }]);

  assert.deepEqual((await sender.rpc('regalar_bricks', { p_receptor_id: 'receiver' })).data, { ok: true });
  const gift = mock.rows('notificaciones', 'receiver')[0];
  assert.equal(gift.type, 'gift_received');
  assert.equal(gift.payload.user, 'AdaCollector');
  assert.equal(gift.payload.amount, 50);
  assert.deepEqual((await receiver.from('notificaciones').select('*')).data.map(({ id }) => id), [gift.id]);
  assert.deepEqual((await sender.from('notificaciones').select('*')).data, []);
  assert.equal((await receiver.from('notificaciones').insert({ type: 'gift_thanks' })).error.code, '42501');
  assert.equal((await receiver.from('notificaciones').update({ payload: { forged: true } }).eq('id', gift.id)).error.code, '42501');
  assert.equal((await receiver.from('agradecimientos_regalo').select('*')).error.code, '42501');

  mock.failNext('notificaciones', { code: 'PGRST000', message: 'fallo' }, 'insert');
  assert.equal((await receiver.rpc('agradecer_regalo', { p_notification_id: gift.id })).error.message, 'fallo');
  assert.equal(mock.rows('agradecimientos_regalo').length, 0);
  assert.equal(mock.rows('gamificacion', 'sender')[0].bricks, 0);
  assert.equal(mock.rows('gamificacion', 'receiver')[0].bricks, 70);

  assert.deepEqual((await receiver.rpc('agradecer_regalo', { p_notification_id: gift.id })).data, { ok: true });
  assert.equal(mock.rows('gamificacion', 'sender')[0].bricks, 5);
  assert.equal(mock.rows('gamificacion', 'sender')[0].logros.some(({ id }) => id === 'thanks-for-the-gift'), false);
  assert.equal(mock.rows('gamificacion', 'receiver')[0].bricks, 75);
  assert.equal(mock.rows('gamificacion', 'receiver')[0].logros.find(({ id }) => id === 'gratitude-is-the-sign-of-noble-souls')?.total, 5);
  assert.equal(mock.rows('notificaciones', 'receiver')[0].is_read, false);
  assert.equal(mock.rows('notificaciones', 'sender')[0].type, 'gift_thanks');
  assert.equal(mock.rows('notificaciones', 'sender')[0].payload.user, 'GraceCollector');
  assert.equal((await receiver.rpc('agradecer_regalo', { p_notification_id: gift.id })).error.message, 'REGALO_YA_AGRADECIDO');
  assert.deepEqual((await receiver.rpc('agradecimientos_regalo_count')).data, { sent: 1, received: 0 });
  assert.deepEqual((await sender.rpc('agradecimientos_regalo_count')).data, { sent: 0, received: 1 });

  const counts = await mock.createAdminClient().rpc('recalcular_agradecimientos_regalo_count', { p_user_ids: ['sender', 'receiver'] });
  assert.deepEqual(counts.data, [
    { user_id: 'sender', sent_count: 0, received_count: 1 },
    { user_id: 'receiver', sent_count: 1, received_count: 0 },
  ]);
  const markedRead = await receiver.from('notificaciones').update({ is_read: true }).eq('id', gift.id).select('id');
  assert.deepEqual(markedRead.data.map(({ id }) => id), [gift.id]);
  assert.equal(mock.rows('notificaciones', 'receiver')[0].is_read, true);
  assert.equal(mock.rows('notificaciones', 'sender')[0].is_read, false);
});

test('dos regalos concurrentes del mismo donante solo incrementan una vez', async () => {
  const mock = createSupabaseMock({ users: { 'token-a': { id: 'user-a' } } });
  const client = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-a' } } });
  mock.seed('gamificacion', 'user-b', [{ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, logros: [] }]);
  const results = await Promise.all([
    client.rpc('regalar_bricks', { p_receptor_id: 'user-b' }),
    client.rpc('regalar_bricks', { p_receptor_id: 'user-b' }),
  ]);
  assert.equal(results.filter(({ error }) => error === null).length, 1);
  assert.equal(results.filter(({ error }) => error?.message === 'REGALO_YA_ENVIADO').length, 1);
  assert.equal(mock.rows('gamificacion', 'user-b')[0].bricks, 70);
});

test('scripts SQL de prueba insertan 20 usuarios coherentes y revierten solo su rastro', async () => {
  const db = new PGlite();
  const originalA = '00000000-0000-4000-8000-00000000000a';
  const originalB = '00000000-0000-4000-8000-00000000000b';
  const reservedId = '13000000-0000-4000-8000-000000000001';
  const insertSql = await readFile(new URL('../supabase/insert-miniPeopleDB-prueba.sql', import.meta.url), 'utf8');
  const rollbackSql = await readFile(new URL('../supabase/rollback-miniPeopleDB-prueba.sql', import.meta.url), 'utf8');
  const categories = JSON.parse(await readFile(new URL('../data/categorias-brickset.json', import.meta.url), 'utf8'));
  const tables = [
    'auth.users', 'public.minifiguras', 'public.gamificacion', 'public.perfiles_publicos',
    'public.user_profiles', 'public.user_profile_favorite_categories', 'public.regalos_enviados',
  ];
  const snapshot = async () => {
    const result = {};
    for (const table of tables) {
      result[table] = (await db.query(`select to_jsonb(item) as data from ${table} item order by to_jsonb(item)::text`)).rows;
    }
    return result;
  };
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
    await db.exec('create publication supabase_realtime');
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    assert.equal((await db.query("select count(*)::integer as total from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificaciones'")).rows[0].total, 1);
    assert.equal((await db.query("select has_table_privilege('authenticated', 'public.notificaciones', 'SELECT') as allowed")).rows[0].allowed, true);
    assert.equal((await db.query("select has_table_privilege('authenticated', 'public.notificaciones', 'INSERT') as allowed")).rows[0].allowed, false);
    assert.equal((await db.query("select has_column_privilege('authenticated', 'public.notificaciones', 'is_read', 'UPDATE') as allowed")).rows[0].allowed, true);
    assert.equal((await db.query("select has_column_privilege('authenticated', 'public.notificaciones', 'payload', 'UPDATE') as allowed")).rows[0].allowed, false);
    for (const table of ['public.agradecimientos_regalo', 'public.ranking_top10_membership']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal((await db.query('select has_table_privilege($1, $2, $3) as allowed', ['authenticated', table, privilege])).rows[0].allowed, false);
        assert.equal((await db.query('select has_table_privilege($1, $2, $3) as allowed', ['service_role', table, privilege])).rows[0].allowed, false);
      }
    }
    const inboxUser = '00000000-0000-4000-8000-0000000000e1';
    const otherInboxUser = '00000000-0000-4000-8000-0000000000e2';
    await db.query('insert into auth.users(id) values ($1), ($2)', [inboxUser, otherInboxUser]);
    await db.query("insert into public.notificaciones(user_id, type, payload) values ($1, 'gift_thanks', '{\"message\":\"own\"}'), ($2, 'gift_thanks', '{\"message\":\"other\"}')", [inboxUser, otherInboxUser]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [inboxUser]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select count(*)::integer as total from public.notificaciones')).rows[0].total, 1);
    assert.equal((await db.query('update public.notificaciones set is_read = true where user_id = $1 returning id', [otherInboxUser])).rows.length, 0);
    assert.equal((await db.query('update public.notificaciones set is_read = true where user_id = $1 returning id', [inboxUser])).rows.length, 1);
    await assert.rejects(db.query("update public.notificaciones set payload = '{\"forged\":true}' where user_id = $1", [inboxUser]), /permission denied/);
    await assert.rejects(db.query("insert into public.notificaciones(user_id, type) values ($1, 'gift_thanks')", [inboxUser]), /permission denied/);
    await assert.rejects(db.query('delete from public.notificaciones where user_id = $1', [inboxUser]), /permission denied/);
    await db.exec('reset role');
    await db.query('delete from auth.users where id in ($1, $2)', [inboxUser, otherInboxUser]);
    const projectedDnaWeights = Object.fromEntries(proyectarPesosDnaSql().map(({
      logro_id, rarity_hunter, collector, explorer, fan,
    }) => [logro_id, [rarity_hunter, collector, explorer, fan]]));
    assert.equal(Object.keys(projectedDnaWeights).length, 115);
    assert.deepEqual(Object.keys(projectedDnaWeights).sort(), OBJETIVOS.map(({ id }) => id).sort());
    for (const weights of DNA_PONDERACIONES.values()) {
      const values = Object.values(weights);
      assert.equal(values.every((weight) => Number.isInteger(weight) && weight >= 0 && weight <= 100), true);
      assert.equal([0, 100].includes(values.reduce((sum, weight) => sum + weight, 0)), true);
    }
    assert.deepEqual(DNA_PONDERACIONES.get('youngling'), { collector: 5, rarityHunter: 0, fan: 95, explorer: 0 });
    assert.deepEqual(DNA_PONDERACIONES.get('curiosity-driven'), { collector: 0, rarityHunter: 0, fan: 0, explorer: 0 });
    const dnaRows = (await db.query('select logro_id, rarity_hunter, collector, explorer, fan from public.dna_ponderaciones order by logro_id')).rows;
    assert.deepEqual(Object.fromEntries(dnaRows.map(({ logro_id, rarity_hunter, collector, explorer, fan }) => [logro_id, [rarity_hunter, collector, explorer, fan]])), projectedDnaWeights);
    assert.equal((await db.query("select count(*)::integer as total from pg_policies where schemaname = 'public' and tablename = 'dna_ponderaciones'")).rows[0].total, 0);
    for (const role of ['anon', 'authenticated']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal((await db.query('select has_table_privilege($1, $2, $3) as allowed', [role, 'public.dna_ponderaciones', privilege])).rows[0].allowed, false);
      }
      assert.equal((await db.query("select has_function_privilege($1, 'private.dna_calcular(uuid)', 'EXECUTE') as allowed", [role])).rows[0].allowed, false);
    }
    await assert.rejects(db.query("insert into public.dna_ponderaciones values ('invalid-total', 1, 1, 1, 1)"), /dna_ponderaciones_suma_check/);
    await assert.rejects(db.query("insert into public.dna_ponderaciones values ('invalid-range', 101, 0, 0, 0)"), /dna_ponderaciones_pesos_check/);
    await assert.rejects(db.query("insert into public.dna_ponderaciones values ('someone-liked-your-collection', 0, 0, 0, 1)"), /dna_ponderaciones_suma_check/);
    await db.query("update public.dna_ponderaciones set rarity_hunter = 0, collector = 100, explorer = 0, fan = 0 where logro_id = 'solid-investment'");
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    const reseeded = (await db.query("select rarity_hunter, collector, explorer, fan from public.dna_ponderaciones where logro_id = 'solid-investment'")).rows[0];
    assert.deepEqual(Object.values(reseeded), projectedDnaWeights['solid-investment']);
    const dnaUser = '00000000-0000-4000-8000-0000000000dd';
    const dnaMock = createSupabaseMock();
    await db.query('insert into auth.users(id,email) values ($1,$2)', [dnaUser, 'dna-fixture@example.invalid']);
    await db.query("insert into public.gamificacion(user_id, logros) values ($1, '[]'::jsonb)", [dnaUser]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [dnaUser]);
    const originalDnaLogros = (await db.query('select logros from public.gamificacion where user_id = $1', [dnaUser])).rows[0].logros;
    const equalWeights = {
      'test-rarity': [100, 0, 0, 0],
      'test-collector': [0, 100, 0, 0],
      'test-explorer': [0, 0, 100, 0],
      'test-fan': [0, 0, 0, 100],
      'test-balanced': [25, 25, 25, 25],
      'test-near': [26, 25, 25, 24],
    };
    await db.query('insert into public.dna_ponderaciones(logro_id, rarity_hunter, collector, explorer, fan) select key, (value->>0)::smallint, (value->>1)::smallint, (value->>2)::smallint, (value->>3)::smallint from jsonb_each($1::jsonb)', [JSON.stringify(equalWeights)]);
    const verifyDna = async (logros, expectedPrincipal, expectedPercentages, additionalWeights = {}) => {
      await db.query('update public.gamificacion set logros = $2 where user_id = $1', [dnaUser, JSON.stringify(logros)]);
      const beforeDnaRead = (await db.query('select to_jsonb(g) as row from public.gamificacion g where user_id = $1', [dnaUser])).rows[0].row;
      const sqlResult = (await db.query('select private.dna_calcular($1) as data', [dnaUser])).rows[0].data;
      const rankingResult = (await db.query('select dna_principal, dna_rasgos from public.ranking_global()')).rows;
      const mockResult = dnaMock.calculateDna(logros, additionalWeights);
      assert.equal(sqlResult.principal, expectedPrincipal);
      assert.equal(rankingResult.length, 1);
      assert.equal(rankingResult[0].dna_principal, expectedPrincipal);
      const expectedTraits = [
        ['rarityHunter', 'Rarity Hunter'], ['explorer', 'Explorer'], ['collector', 'Collector'], ['fan', 'Fan'],
      ].map(([key, nombre], ordinal) => ({ nombre, porcentaje: expectedPercentages[key], ordinal }));
      expectedTraits.sort((left, right) => Number(right.nombre === expectedPrincipal) - Number(left.nombre === expectedPrincipal)
        || right.porcentaje - left.porcentaje || left.ordinal - right.ordinal);
      const summary = rankingResult[0].dna_rasgos;
      assert.equal(summary.length, expectedPrincipal === 'Newbie' ? 0 : 2);
      summary.forEach((trait, index) => {
        assert.deepEqual(Object.keys(trait).sort(), ['nombre', 'porcentaje']);
        assert.equal(trait.nombre, expectedTraits[index].nombre);
        assert.ok(Math.abs(Number(trait.porcentaje) - expectedTraits[index].porcentaje) < 1e-10);
      });
      assert.equal(mockResult.principal, expectedPrincipal);
      for (const [name, expected] of Object.entries(expectedPercentages)) {
        assert.ok(Math.abs(Number(sqlResult.porcentajes[name]) - expected) < 1e-10, `${name}: SQL=${sqlResult.porcentajes[name]}, esperado=${expected}`);
        assert.ok(Math.abs(mockResult.porcentajes[name] - expected) < 1e-10, `${name}: mock=${mockResult.porcentajes[name]}, esperado=${expected}`);
      }
      const afterDnaRead = (await db.query('select to_jsonb(g) as row from public.gamificacion g where user_id = $1', [dnaUser])).rows[0].row;
      assert.deepEqual(afterDnaRead, beforeDnaRead);
      return sqlResult;
    };
    await verifyDna([
      { id: 'solid-investment', cantidad: 2 }, { id: 'sweet-find', cantidad: 1 },
      { id: 'unknown-achievement', cantidad: 1000 }, { id: LOGRO_REGALO.id, cantidad: 1000 },
    ], 'Collector', { rarityHunter: 5, explorer: 5, collector: 80, fan: 10 });
    await verifyDna([{ id: 'the-cornerstone', cantidad: 3 }], 'Explorer', { rarityHunter: 0, explorer: 90, collector: 10, fan: 0 });
    await verifyDna([{ id: 'pure-gold-zero-leprechauns-required', cantidad: 1 }], 'Rarity Hunter', { rarityHunter: 100, explorer: 0, collector: 0, fan: 0 });
    for (const id of ['youngling', 'muggle', 'sidekick', 'mouseketeer']) {
      await verifyDna([{ id, cantidad: 1 }], 'Fan', { rarityHunter: 0, collector: 5, explorer: 0, fan: 95 });
    }
    for (const id of ['retired-police', 'retired-firefighter', 'retired-courier']) {
      await verifyDna([{ id, cantidad: 1 }], 'Rarity Hunter', { rarityHunter: 80, collector: 20, explorer: 0, fan: 0 });
    }
    for (const id of ['curator', 'grail-seeker', 'nerd', 'curiosity-driven']) {
      await verifyDna([{ id, cantidad: 1 }], 'Newbie', { rarityHunter: 0, explorer: 0, collector: 0, fan: 0 });
    }
    for (const id of ['category-halfway', 'theme-specialist', 'grand-category-legend']) {
      await verifyDna([{ id, cantidad: 2 }], 'Collector', { rarityHunter: 0, collector: 60, explorer: 0, fan: 40 });
    }
    await verifyDna([{ id: LOGRO_REGALO.id, cantidad: 99 }], 'Newbie', { rarityHunter: 0, explorer: 0, collector: 0, fan: 0 });
    await db.query('update public.gamificacion set logros = $2 where user_id = $1', [dnaUser, JSON.stringify(originalDnaLogros)]);
    const noStateDna = (await db.query('select private.dna_calcular($1) as data', ['00000000-0000-4000-8000-0000000000ff'])).rows[0].data;
    assert.deepEqual(noStateDna, { principal: 'Newbie', porcentajes: { rarityHunter: 0, explorer: 0, collector: 0, fan: 0 } });
    const fourWayTie = Object.keys(equalWeights).slice(0, 4).map((id) => ({ id, cantidad: 1 }));
    await verifyDna(fourWayTie, 'Explorer', { rarityHunter: 25, explorer: 25, collector: 25, fan: 25 }, equalWeights);
    await verifyDna(fourWayTie.filter(({ id }) => id !== 'test-explorer'), 'Collector', { rarityHunter: 100 / 3, explorer: 0, collector: 100 / 3, fan: 100 / 3 }, equalWeights);
    await verifyDna(fourWayTie.filter(({ id }) => id === 'test-fan' || id === 'test-rarity'), 'Fan', { rarityHunter: 50, explorer: 0, collector: 0, fan: 50 }, equalWeights);
    const nearTie = [{ id: 'test-balanced', cantidad: 10000 }, { id: 'test-near', cantidad: 1 }];
    const nearTieResult = await verifyDna(nearTie, 'Rarity Hunter', { rarityHunter: (250000 + 26) / 1000100 * 100, explorer: 250025 / 1000100 * 100, collector: 250025 / 1000100 * 100, fan: 250024 / 1000100 * 100 }, equalWeights);
    assert.deepEqual(Object.values(nearTieResult.porcentajes).map((percentage) => Math.round(Number(percentage))), [25, 25, 25, 25]);
    const otherDnaUser = '00000000-0000-4000-8000-0000000000de';
    await db.query('insert into auth.users(id,email) values ($1,$2)', [otherDnaUser, 'dna-fixture-2@example.invalid']);
    await db.query('update public.gamificacion set logros = $2 where user_id = $1', [dnaUser, JSON.stringify([{ id: 'test-mutable', cantidad: 1 }])]);
    await db.query('insert into public.gamificacion(user_id, logros) values ($1, $2)', [otherDnaUser, JSON.stringify([{ id: 'test-mutable', cantidad: 2 }, { id: 'test-fan', cantidad: 1 }])]);
    const principals = async () => (await db.query('select private.dna_calcular($1)->>$3 as a, private.dna_calcular($2)->>$3 as b', [dnaUser, otherDnaUser, 'principal'])).rows[0];
    assert.deepEqual(await principals(), { a: 'Newbie', b: 'Fan' });
    await db.query("insert into public.dna_ponderaciones values ('test-mutable', 0, 0, 100, 0)");
    assert.deepEqual(await principals(), { a: 'Explorer', b: 'Explorer' });
    await db.query("update public.dna_ponderaciones set collector = 100, explorer = 0 where logro_id = 'test-mutable'");
    assert.deepEqual(await principals(), { a: 'Collector', b: 'Collector' });
    await db.query("delete from public.dna_ponderaciones where logro_id = 'test-mutable'");
    assert.deepEqual(await principals(), { a: 'Newbie', b: 'Fan' });
    await db.query('delete from public.gamificacion where user_id = $1', [otherDnaUser]);
    await db.query('delete from auth.users where id = $1', [otherDnaUser]);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from public.dna_ponderaciones'), /permission denied/);
      await assert.rejects(db.query("insert into public.dna_ponderaciones values ('client-write', 25, 25, 25, 25)"), /permission denied/);
      await assert.rejects(db.query("select private.dna_calcular('00000000-0000-4000-8000-00000000000a')"), /permission denied/);
      await db.exec('reset role');
    }
    await db.query("delete from public.dna_ponderaciones where logro_id like 'test-%'");
    await db.query('delete from public.gamificacion where user_id = $1', [dnaUser]);
    await db.query('delete from auth.users where id = $1', [dnaUser]);
    await db.query('insert into auth.users(id,email) values ($1,$2),($3,$4)', [originalA, 'original-a@example.invalid', originalB, 'original-b@example.invalid']);
    await db.query(`insert into public.minifiguras(user_id,id,nombre,categoria,anio,precio) values ($1,'ORIGINAL','Original','Space',2020,20)`, [originalA]);
    await db.query(`insert into public.perfiles_publicos(user_id,display_name) values ($1,'Original A'),($2,'Original B')`, [originalA, originalB]);
    await db.query('insert into public.regalos_enviados(donante_id,receptor_id) values ($1,$2)', [originalA, originalB]);
    for (const [userId, catalog, gifts] of [
      [originalA, [{ id: 'ORIGINAL', categoria: 'Space', precio: 20, estadoColeccion: 'COLECCIÓN' }], 0],
      [originalB, [], 1],
    ]) {
      const state = calcularGamificacion(catalog, categories, gifts);
      await db.query('insert into public.gamificacion(user_id,bricks,nivel,siguiente_nivel,progreso,logros) values ($1,$2,$3,$4,$5,$6)', [
        userId, state.bricks, JSON.stringify(state.nivel), JSON.stringify(state.siguienteNivel), JSON.stringify(state.progreso), JSON.stringify(state.logros),
      ]);
    }
    const receiverBricks = (await db.query('select bricks from public.gamificacion where user_id = $1', [originalA])).rows[0].bricks;
    await db.exec(`
      create function public.fail_gift_notification() returns trigger language plpgsql as $$
      begin
        if new.type = 'gift_received' then raise exception 'TEST_GIFT_NOTIFICATION_FAILURE'; end if;
        return new;
      end $$;
      create trigger fail_gift_notification before insert on public.notificaciones
        for each row execute function public.fail_gift_notification();
    `);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [originalB]);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select public.regalar_bricks($1)', [originalA]), /TEST_GIFT_NOTIFICATION_FAILURE/);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::integer as total from public.regalos_enviados where donante_id = $1 and receptor_id = $2', [originalB, originalA])).rows[0].total, 0);
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [originalA])).rows[0].bricks, receiverBricks);
    await db.exec('drop trigger fail_gift_notification on public.notificaciones; drop function public.fail_gift_notification()');
    await db.exec('set role authenticated');
    assert.deepEqual((await db.query('select public.regalar_bricks($1) as result', [originalA])).rows[0].result, { ok: true });
    await db.exec('reset role');
    const giftNotification = (await db.query("select * from public.notificaciones where user_id = $1 and type = 'gift_received'", [originalA])).rows[0];
    assert.equal(giftNotification.gift_donante_id, originalB);
    assert.equal(giftNotification.payload.amount, 50);
    assert.equal(giftNotification.payload.user, 'Coleccionista');
    assert.equal(giftNotification.payload.message, 'El usuario Coleccionista vio tus tops en el Ranking Global y te regaló 50 Bricks 🧱');
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select public.regalar_bricks($1)', [originalA]), /REGALO_YA_ENVIADO/);
    await db.exec('reset role');

    const donorBricks = (await db.query('select bricks from public.gamificacion where user_id = $1', [originalB])).rows[0].bricks;
    await db.exec(`
      create function public.fail_thanks_notification() returns trigger language plpgsql as $$
      begin
        if new.type = 'gift_thanks' then raise exception 'TEST_THANKS_NOTIFICATION_FAILURE'; end if;
        return new;
      end $$;
      create trigger fail_thanks_notification before insert on public.notificaciones
        for each row execute function public.fail_thanks_notification();
    `);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [originalA]);
    await assert.rejects(db.query('select public.agradecer_regalo($1)', [giftNotification.id]), /TEST_THANKS_NOTIFICATION_FAILURE/);
    assert.equal((await db.query('select count(*)::integer as total from public.agradecimientos_regalo where gift_notification_id = $1', [giftNotification.id])).rows[0].total, 0);
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [originalB])).rows[0].bricks, donorBricks);
    await db.exec('drop trigger fail_thanks_notification on public.notificaciones; drop function public.fail_thanks_notification()');
    assert.deepEqual((await db.query('select public.agradecer_regalo($1) as result', [giftNotification.id])).rows[0].result, { ok: true });
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [originalB])).rows[0].bricks, donorBricks + 5);
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [originalA])).rows[0].bricks, receiverBricks + 75);
    assert.equal((await db.query('select logros from public.gamificacion where user_id = $1', [originalB])).rows[0].logros.some(({ id }) => id === 'gratitude-is-the-sign-of-noble-souls'), false);
    assert.equal((await db.query('select logros from public.gamificacion where user_id = $1', [originalA])).rows[0].logros.find(({ id }) => id === 'gratitude-is-the-sign-of-noble-souls').total, 5);
    await assert.rejects(db.query('select public.agradecer_regalo($1)', [giftNotification.id]), /REGALO_YA_AGRADECIDO/);
    const ownThanks = (await db.query('select public.agradecimientos_regalo_count() as data')).rows[0].data;
    assert.deepEqual(ownThanks, { sent: 1, received: 0 });
    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    await db.exec('set role service_role');
    assert.deepEqual((await db.query('select * from public.recalcular_agradecimientos_regalo_count($1)', [[originalA, originalB]])).rows, [
      { user_id: originalA, sent_count: 1, received_count: 0 },
      { user_id: originalB, sent_count: 0, received_count: 1 },
    ]);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from public.recalcular_agradecimientos_regalo_count($1)', [[originalA]]), /permission denied/);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.role', '', false)");
    const original = await snapshot();
    await db.exec(insertSql);
    assert.equal((await db.query('select count(*)::integer as total from auth.users')).rows[0].total, 22);
    assert.equal((await db.query('select count(*)::integer as total from public.user_daily_snapshots')).rows[0].total, 40);
    assert.equal((await db.query("select count(*)::integer as total from public.notificaciones where type = 'daily_summary'")).rows[0].total, 20);
    assert.ok((await db.query('select count(*)::integer as total from public.agradecimientos_regalo')).rows[0].total > 0);
    assert.equal((await db.query("select count(*)::integer as total from public.ranking_top10_membership where ranking_type = 'global'")).rows[0].total, 10);
    const users = (await db.query("select * from auth.users where raw_user_meta_data->>'minipeopledb_seed' = 'lego-13-prueba-v1' order by id")).rows;
    assert.equal(users.length, 20);
    assert.ok(users.every((user) => user.encrypted_password === null && user.email.endsWith('@example.invalid')));
    const mock = createSupabaseMock({ users: Object.fromEntries(users.map((user) => [user.id, { id: user.id }])) });
    for (const table of ['regalos_enviados', 'friend_requests', 'friendships', 'agradecimientos_regalo']) {
      const rows = (await db.query(`select to_jsonb(item) as data from public.${table} item`)).rows.map(({ data }) => data);
      mock.seed(table, undefined, rows);
    }
    const levels = new Set();
    for (const user of users) {
      const rows = (await db.query('select to_jsonb(item) as data from public.minifiguras item where user_id = $1', [user.id])).rows.map(({ data }) => data);
      const sources = (await db.query(`
        select
          (select count(*)::integer from public.friendships friendship
            where $1::uuid in (friendship.user_low_id, friendship.user_high_id)) as friends,
          (select count(*)::integer from public.friend_requests request
            where request.sender_id = $1 and request.status = 'pending') as sent_pending,
          (select count(*)::integer from public.friend_requests request
            where request.sender_id = $1 and request.status = 'accepted') as accepted_sent,
          (select count(*)::integer from public.friend_requests request
            where request.recipient_id = $1 and request.status = 'accepted') as accepted_received,
          (select count(*)::integer from public.regalos_enviados gift
            where gift.receptor_id = $1 and gift.semana = '0001-01-01') as global_gifts_received,
          (select count(*)::integer from public.regalos_enviados gift
            where gift.receptor_id = $1 and gift.semana <> '0001-01-01') as weekly_gifts_received,
          (select count(*)::integer from public.agradecimientos_regalo thanks
            where thanks.thanker_id = $1) as thanks_sent,
          (select count(*)::integer from public.agradecimientos_regalo thanks
            where thanks.donor_id = $1) as thanks_received
      `, [user.id])).rows[0];
      mock.seed('minifiguras', user.id, rows);
      const client = mock.createClient('url', 'key', { global: { headers: { Authorization: `Bearer ${user.id}` } } });
      const catalog = await new MinifigurasRepository({ client, userId: user.id, categoriasRepository: { read: async () => categories } }).readCatalog();
      const expected = calcularGamificacion(
        catalog, categories, sources.global_gifts_received, sources.thanks_received,
        sources.weekly_gifts_received, sources,
      );
      await db.query(`update public.gamificacion set
        bricks = $2, nivel = $3::jsonb, siguiente_nivel = $4::jsonb, progreso = $5::jsonb, logros = $6::jsonb
        where user_id = $1`, [
        user.id, expected.bricks, JSON.stringify(expected.nivel), JSON.stringify(expected.siguienteNivel),
        JSON.stringify(expected.progreso), JSON.stringify(expected.logros),
      ]);
      const state = (await db.query('select * from public.gamificacion where user_id = $1', [user.id])).rows[0];
      mock.seed('gamificacion', user.id, [state]);
      const stored = await new GamificacionRepository({ client, userId: user.id }).read();
      assert.equal(stored.bricks, expected.bricks, JSON.stringify({ userId: user.id, stored: stored.bricks, expected: expected.bricks, sources }));
      assert.deepEqual(stored.nivel, expected.nivel);
      assert.deepEqual(stored.siguienteNivel, expected.siguienteNivel);
      assert.deepEqual(stored.progreso, expected.progreso);
      const metrics = (items) => items.map(({ descripcion, ...item }) => item);
      assert.deepEqual(metrics(stored.logros), metrics(expected.logros));
      assert.equal(catalog.filter((item) => item.estadoColeccion === 'BUSCADA').length, 1);
      assert.ok(catalog.filter((item) => item.observada).length <= 10);
      levels.add(stored.nivel.id);
    }
    assert.ok(levels.size >= 8);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [originalA]);
    const ranking = (await db.query('select * from public.ranking_global()')).rows;
    assert.equal(ranking.length, 10);
    assert.ok(ranking.every((entry) => entry.top5_precio.length >= 3 && entry.top5_antiguedad.length >= 3));
    assert.ok(ranking.every((entry) => typeof entry.dna_principal === 'string'));
    await db.exec('begin');
    await db.exec('delete from public.gamificacion');
    await db.query(`update public.dna_ponderaciones set collector = 100, rarity_hunter = 0, explorer = 0, fan = 0 where logro_id = 'unicorn'`);
    await db.query(`update public.dna_ponderaciones set collector = 0, rarity_hunter = 0, explorer = 100, fan = 0 where logro_id = 'the-cornerstone'`);
    await db.query(`update public.dna_ponderaciones set collector = 0, rarity_hunter = 0, explorer = 0, fan = 100 where logro_id = 'your-adventure-begins'`);
    const orderIds = Array.from({ length: 12 }, (_, index) => `23000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
    for (const [index, userId] of orderIds.entries()) {
      await db.query('insert into auth.users(id) values ($1)', [userId]);
      await db.query('insert into public.gamificacion(user_id, bricks, nivel, logros) values ($1, $2, $3, $4)', [
        userId, index < 10 ? (index < 2 ? 1000 : 1000 - index) : index === 10 ? 5 : 10,
        JSON.stringify({ id: index < 10 ? 3 : index === 10 ? 2 : 1 }),
        JSON.stringify(index < 10
          ? ({
            9: 'pure-gold-zero-leprechauns-required', 8: 'unicorn',
            7: 'the-cornerstone', 6: 'your-adventure-begins',
          }[index] ? [{ id: ({
            9: 'pure-gold-zero-leprechauns-required', 8: 'unicorn',
            7: 'the-cornerstone', 6: 'your-adventure-begins',
          }[index]), cantidad: 1 }] : [])
          : ['pure-gold-zero-leprechauns-required', 'unicorn', 'the-cornerstone', 'your-adventure-begins'].map((id) => ({ id, cantidad: 1 }))),
      ]);
      if (index === 9 || index >= 10) {
        await db.query("insert into public.minifiguras(user_id,id,nombre,categoria) values ($1,'ONE','One','Space')", [userId]);
      } else {
        await db.query("insert into public.minifiguras(user_id,id,nombre,categoria,estado_coleccion) values ($1,'WANTED','Wanted','Space','BUSCADA')", [userId]);
      }
    }
    const defaultOrder = (await db.query('select * from public.ranking_global()')).rows;
    assert.deepEqual(defaultOrder.map(({ user_id }) => user_id), orderIds.slice(0, 10));
    const expectedOrders = {
      nivel: orderIds.slice(0, 10),
      coleccion: [orderIds[9], ...orderIds.slice(0, 9)],
      rarityHunter: [orderIds[9], ...orderIds.slice(0, 9)],
      collector: [orderIds[8], ...orderIds.slice(0, 8), orderIds[9]],
      explorer: [orderIds[7], ...orderIds.slice(0, 7), ...orderIds.slice(8, 10)],
      fan: [orderIds[6], ...orderIds.slice(0, 6), ...orderIds.slice(7, 10)],
    };
    for (const criterio of ['nivel', 'coleccion', 'rarityHunter', 'collector', 'explorer', 'fan']) {
      const ordered = (await db.query('select * from public.ranking_global($1)', [criterio])).rows;
      assert.equal(ordered.length, 10);
      assert.deepEqual(ordered.map(({ user_id }) => user_id), expectedOrders[criterio], criterio);
      assert.ok(ordered.every((row) => !('dna_porcentajes' in row) && row.dna_rasgos.length <= 2));
      if (!['nivel', 'coleccion'].includes(criterio)) {
        const nombre = { rarityHunter: 'Rarity Hunter', collector: 'Collector', explorer: 'Explorer', fan: 'Fan' }[criterio];
        assert.deepEqual(ordered[0].dna_rasgos, [{ nombre, porcentaje: 100 }]);
        assert.deepEqual(ordered[2].dna_rasgos, [{ nombre, porcentaje: 0 }]);
      }
      assert.equal((await db.query("select has_function_privilege('anon', 'public.ranking_global(text)', 'EXECUTE') as allowed")).rows[0].allowed, false);
    }
    assert.deepEqual((await db.query("select * from public.ranking_global('invalid')")).rows, []);
    for (const [criterio, logroId] of [['rarityHunter', 'weirdo'], ['collector', 'hooked'], ['explorer', 'land-ho'], ['fan', 'nerd']]) {
      await db.query('update public.gamificacion set logros = $1 where user_id = $2', [JSON.stringify([{ id: logroId, cantidad: 1 }]), orderIds[10]]);
      const ordered = (await db.query('select * from public.ranking_global($1)', [criterio])).rows;
      assert.deepEqual(ordered.map(({ user_id }) => user_id), expectedOrders[criterio]);
      assert.equal(ordered.some(({ user_id }) => user_id === orderIds[10]), false);
    }
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    assert.deepEqual((await db.query("select * from public.ranking_global('fan')")).rows, []);
    await db.exec('rollback');
    const ownDnaBefore = (await db.query('select to_jsonb(g) as row from public.gamificacion g where user_id = $1', [originalA])).rows[0].row;
    const ownDna = (await db.query('select public.gamificacion_dna() as data')).rows[0].data;
    const directDna = (await db.query('select private.dna_calcular($1) as data', [originalA])).rows[0].data;
    assert.deepEqual(ownDna, directDna);
    assert.deepEqual(Object.keys(ownDna).sort(), ['porcentajes', 'principal']);
    assert.deepEqual(Object.keys(ownDna.porcentajes).sort(), ['collector', 'explorer', 'fan', 'rarityHunter']);
    assert.deepEqual((await db.query('select to_jsonb(g) as row from public.gamificacion g where user_id = $1', [originalA])).rows[0].row, ownDnaBefore);
    await db.exec('set role anon');
    await assert.rejects(db.query('select public.gamificacion_dna()'), /permission denied/);
    await db.exec('reset role');
    await db.exec('set role authenticated');
    assert.deepEqual((await db.query('select public.gamificacion_dna() as data')).rows[0].data, ownDna);
    assert.equal((await db.query("select has_function_privilege('authenticated', 'public.ranking_global(text)', 'EXECUTE') as allowed")).rows[0].allowed, true);
    await db.exec('reset role');
    assert.equal((await db.query('select public.ranking_logros($1) as data', [originalA])).rows[0].data, null);
    assert.ok((await db.query('select public.ranking_logros($1) as data', [ranking[0].user_id])).rows[0].data.logros.length > 0);
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query("select has_function_privilege($1, 'public.gamificacion_dna()', 'EXECUTE') as allowed", [role])).rows[0].allowed, role === 'authenticated');
    }

    const inserted = await snapshot();
    await assert.rejects(db.exec(insertSql), /Seed collision/);
    await db.exec('rollback');
    assert.deepEqual(await snapshot(), inserted);
    await db.query('insert into public.regalos_enviados(donante_id,receptor_id) values ($1,$2)', [reservedId, originalA]);
    await assert.rejects(db.exec(rollbackSql), /gifted Bricks to non-seeded users/);
    await db.exec('rollback');
    assert.equal((await db.query('select count(*)::integer as total from auth.users')).rows[0].total, 22);
    await db.query('delete from public.regalos_enviados where donante_id = $1 and receptor_id = $2', [reservedId, originalA]);
    await db.exec(rollbackSql);
    assert.deepEqual(await snapshot(), original);
    await db.exec(rollbackSql);
    assert.deepEqual(await snapshot(), original);

    await db.query('insert into auth.users(id,email) values ($1,$2)', [reservedId, 'non-seeded@example.invalid']);
    const collision = await snapshot();
    await assert.rejects(db.exec(insertSql), /Seed collision/);
    await db.exec('rollback');
    assert.deepEqual(await snapshot(), collision);
    await assert.rejects(db.exec(rollbackSql), /not owned by this seed/);
    await db.exec('rollback');
    assert.deepEqual(await snapshot(), collision);
  } finally {
    await db.close();
  }
});
