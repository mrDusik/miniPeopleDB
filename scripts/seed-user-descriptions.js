#!/usr/bin/env node

/**
 * Script para crear registros iniciales en user_profile_descriptions para todos los usuarios
 * Esto permite que el worker tenga usuarios para procesar
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

    // Get all users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      console.error('Error al obtener usuarios:', usersError.message);
      process.exit(1);
    }
    console.log(`✓ Encontrados ${users.users.length} usuarios`);

    // Try to insert into user_profile_descriptions
    console.log('\nInsertando registros iniciales en user_profile_descriptions...');
    
    for (const user of users.users) {
      // Try to insert (or ignore if already exists)
      const { error } = await supabase
        .from('user_profile_descriptions')
        .insert([
          {
            user_id: user.id,
            // Don't set descriptions yet - let the worker generate them
            created_by: user.id,
          }
        ])
        .select();
      
      if (error) {
        // If table doesn't exist or other error, log it
        if (error.message.includes('does not exist') || error.message.includes('relation')) {
          console.log('\n⚠ Tabla user_profile_descriptions no existe');
          console.log('Debes ejecutar la migración en Supabase Studio:');
          console.log('1. Abre https://supabase.com/dashboard');
          console.log('2. Ve a SQL Editor');
          console.log('3. Copia el contenido de supabase/migrations/20261102_user_profile_descriptions.sql');
          console.log('4. Ejecuta todas las sentencias');
          console.log('5. Ejecuta este script de nuevo');
          process.exit(1);
        } else if (error.code !== '23505') { // duplicate key
          console.log(`⚠ Usuario ${user.id}: ${error.message}`);
        }
      } else {
        console.log(`✓ Usuario ${user.email || user.id}`);
      }
    }

    console.log('\n✓ Registros iniciales creados');
    console.log('\nAhora ejecuta: node scripts/generate-descriptions.js');
    process.exit(0);
  } catch (error) {
    console.error('Error fatal:', error.message);
    process.exit(1);
  }
}

main();
