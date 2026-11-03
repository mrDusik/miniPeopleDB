#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const content = readFileSync('sup.env', 'utf8');
const url = content.match(/SUPABASE_URL=(.+)/)[1];
const key = content.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1];

const sql = `
DROP POLICY IF EXISTS "rls_no_authenticated_access" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_anon_denied" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_users_read_own_description" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_users_read_public_descriptions" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_no_authenticated_write" ON user_profile_descriptions;

CREATE POLICY "rls_users_read_own_description" ON user_profile_descriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "rls_users_read_public_descriptions" ON user_profile_descriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() != user_id);

CREATE POLICY "rls_no_authenticated_write" ON user_profile_descriptions
  AS RESTRICTIVE FOR UPDATE, DELETE, INSERT
  TO authenticated
  USING (FALSE);

CREATE POLICY "rls_anon_denied" ON user_profile_descriptions
  AS RESTRICTIVE FOR ALL
  TO anon
  USING (FALSE);
`;

async function executeSql() {
  try {
    const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${key}`,
        'apikey': key,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ sql_query: sql })
    });
    
    if (!response.ok) {
      const err = await response.text();
      console.log('❌ Error HTTP:', response.status, err);
      return false;
    } else {
      console.log('✓ Políticas RLS actualizadas correctamente');
      return true;
    }
  } catch (e) {
    console.log('❌ Error:', e.message);
    return false;
  }
}

executeSql().then(success => {
  if (success) {
    console.log('\nRecarga localhost:3001 para ver las descripciones');
  } else {
    console.log('\n❌ No se pudo ejecutar el SQL automáticamente');
    console.log('Tendrás que hacerlo manualmente en Supabase Studio (SQL Editor)');
    console.log('\nVer FIX_RLS_POLICIES.md para instrucciones');
  }
  process.exit(success ? 0 : 1);
});
