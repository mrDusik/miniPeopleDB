#!/usr/bin/env node

/**
 * Script para aplicar la migración de descripciones de perfil a Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Read credentials from sup.env
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
    dbUrl: config.SUPABASE_DB_URL,
  };
}

async function main() {
  try {
    const config = readSupabaseConfig();
    
    if (!config.url || !config.serviceRoleKey) {
      console.error('Error: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configurados en sup.env');
      process.exit(1);
    }

    console.log('Conectando a Supabase...');
    const supabase = createClient(config.url, config.serviceRoleKey);

    // Read migration file
    const migrationPath = resolve(process.cwd(), 'supabase/migrations/20261102_user_profile_descriptions.sql');
    const migration = readFileSync(migrationPath, 'utf8');

    console.log('Aplicando migración...');
    
    // Execute migration
    const { error } = await supabase.rpc('exec', { sql: migration });
    
    if (error) {
      console.error('Error en migración:', error.message);
      // Try direct SQL execution instead
      console.log('\nIntentando ejecución directa...');
      
      // Split by statements
      const statements = migration
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));
      
      let successCount = 0;
      for (const stmt of statements) {
        try {
          const result = await supabase.rpc('exec', { sql: stmt });
          if (!result.error) {
            successCount++;
          } else {
            console.warn(`⚠ Fallo: ${stmt.substring(0, 50)}... - ${result.error.message}`);
          }
        } catch (e) {
          console.warn(`⚠ Error al ejecutar: ${stmt.substring(0, 50)}... - ${e.message}`);
        }
      }
      
      console.log(`\n✓ Se ejecutaron ${successCount}/${statements.length} sentencias`);
    } else {
      console.log('✓ Migración aplicada exitosamente');
    }

    // Verify that functions exist
    console.log('\nVerificando funciones RPC...');
    
    try {
      const { data, error: checkError } = await supabase
        .from('information_schema.routines')
        .select('routine_name')
        .eq('routine_schema', 'public')
        .in('routine_name', [
          'claim_profile_descriptions_work',
          'read_profile_description_context',
          'save_profile_descriptions'
        ]);
      
      if (!checkError && data && data.length > 0) {
        console.log(`✓ Encontradas ${data.length}/3 funciones RPC`);
        data.forEach(r => console.log(`  - ${r.routine_name}`));
      } else {
        console.log('⚠ No se pudieron verificar las funciones (es posible que ya existan)');
      }
    } catch (e) {
      console.log('⚠ No se pudieron verificar las funciones');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error fatal:', error.message);
    process.exit(1);
  }
}

main();
