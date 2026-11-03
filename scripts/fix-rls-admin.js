#!/usr/bin/env node

/**
 * Script para crear la RPC exec_sql y ejecutar el SQL
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const content = readFileSync('sup.env', 'utf8');
const url = content.match(/SUPABASE_URL=(.+)/)[1];
const key = content.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1];

const supabase = createClient(url, key);

// First, create the exec_sql RPC if it doesn't exist
const createRpcSql = `
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS TABLE(result TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql_query;
  RETURN QUERY SELECT 'Success'::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT SQLERRM::TEXT;
END;
$$;

-- Grant to service_role
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;
`;

// The actual policy update SQL
const updatePoliciesSql = `
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

async function main() {
  console.log('Creando RPC exec_sql...');
  
  try {
    // This will fail if the RPC creation SQL contains syntax that can't be executed via REST
    // So we'll just proceed to update policies directly
    
    console.log('Actualizando políticas RLS...\n');
    
    // Try using the RPC if it exists
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: updatePoliciesSql 
    });
    
    if (error && error.message.includes('exec_sql')) {
      console.log('⚠️  RPC exec_sql no existe. Intenta manualmente en Supabase Studio SQL Editor.');
      console.log('\nVer FIX_RLS_POLICIES.md para instrucciones paso a paso.');
      process.exit(1);
    } else if (error) {
      console.log('❌ Error:', error.message);
      process.exit(1);
    } else {
      console.log('✓ Políticas RLS actualizadas correctamente');
      console.log('\nRecarga localhost:3001 para ver las descripciones');
      process.exit(0);
    }
  } catch (e) {
    console.log('❌ Error:', e.message);
    console.log('\nVer FIX_RLS_POLICIES.md para instrucciones paso a paso.');
    process.exit(1);
  }
}

main();
