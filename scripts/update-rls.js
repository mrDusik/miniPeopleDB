#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const content = readFileSync('sup.env', 'utf8');
const url = content.match(/SUPABASE_URL=(.+)/)[1];
const key = content.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1];

const supabase = createClient(url, key);

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

const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }, { head: false });

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log('✓ Políticas RLS actualizadas correctamente');
console.log('\nLas descripciones deberían aparecer ahora en localhost:3001');
console.log('Recarga la página (F5) si es necesario.');
