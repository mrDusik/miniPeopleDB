#!/usr/bin/env node

/**
 * Script para actualizar las políticas RLS de user_profile_descriptions
 * Permite que los usuarios autenticados lean las descripciones (propia y públicas)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readSupabaseConfig() {
  const envPath = resolve(process.cwd(), 'sup.env');
  const content = readFileSync(envPath, 'utf8');
  const config = {};
  
  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;
    
    const [key, value] = trimmedLine.split('=');
    if (key && value) {
      config[key.trim()] = value.trim();
    }
  }
  
  return {
    url: config.SUPABASE_URL,
    serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
  };
}

const SQL_TO_RUN = `
-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "rls_no_authenticated_access" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_anon_denied" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_users_read_own_description" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_users_read_public_descriptions" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_no_authenticated_write" ON user_profile_descriptions;

-- Create permissive policies for reading descriptions
CREATE POLICY "rls_users_read_own_description" ON user_profile_descriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "rls_users_read_public_descriptions" ON user_profile_descriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() != user_id);

-- Create restrictive policies to block writes from authenticated users
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
  try {
    const config = readSupabaseConfig();
    
    if (!config.url || !config.serviceRoleKey) {
      console.error('Error: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configurados en sup.env');
      process.exit(1);
    }

    console.log('Conectando a Supabase con service_role...');
    const supabase = createClient(config.url, config.serviceRoleKey);

    console.log('Ejecutando SQL para actualizar políticas RLS...\n');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: SQL_TO_RUN }, { head: false });
    
    if (error) {
      console.error('Error al ejecutar SQL:', error.message);
      console.log('\nIntenta copiar y ejecutar este SQL manualmente en Supabase Studio:');
      console.log('---');
      console.log(SQL_TO_RUN);
      console.log('---');
      process.exit(1);
    }

    console.log('✓ Políticas RLS actualizadas correctamente');
    console.log('\nAhora las descripciones serán visibles:');
    console.log('  - Tu propia descripción en /gamificacion/dna');
    console.log('  - Descripciones públicas en /api/amigos/:userId/perfil');

    process.exit(0);
  } catch (error) {
    console.error('Error fatal:', error.message);
    console.log('\nIntenta copiar y ejecutar este SQL manualmente en Supabase Studio:');
    console.log('---');
    console.log(SQL_TO_RUN);
    console.log('---');
    process.exit(1);
  }
}

main();
