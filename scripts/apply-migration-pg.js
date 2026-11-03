#!/usr/bin/env node

/**
 * Script para aplicar la migración de descripciones de perfil a Supabase PostgreSQL
 */

import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { Client } = pg;

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
  let client;
  try {
    const config = readSupabaseConfig();
    
    if (!config.dbUrl) {
      console.error('Error: SUPABASE_DB_URL no está configurado en sup.env');
      process.exit(1);
    }

    // Extract credentials from SUPABASE_DB_URL
    // Format: postgresql://user:password@host:port/database
    const url = new URL(`postgresql://${config.dbUrl}`);
    
    console.log(`Conectando a PostgreSQL: ${url.hostname}...`);
    
    client = new Client({
      user: url.username,
      password: url.password,
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.replace('/', ''),
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    console.log('✓ Conectado a PostgreSQL');

    // Read migration file
    const migrationPath = resolve(process.cwd(), 'supabase/migrations/20261102_user_profile_descriptions.sql');
    const migration = readFileSync(migrationPath, 'utf8');

    console.log('Aplicando migración...');
    
    // Execute migration as a single batch
    try {
      await client.query(migration);
      console.log('✓ Migración aplicada exitosamente');
    } catch (error) {
      // Try splitting by semicolon and executing individually
      console.log('⚠ Intento con ejecución individual...');
      
      const statements = migration
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const stmt of statements) {
        try {
          await client.query(stmt);
          successCount++;
        } catch (e) {
          // Ignore "already exists" errors
          if (e.message.includes('already exists') || e.message.includes('duplicate')) {
            console.log(`  ⚠ Ya existe: ${stmt.substring(0, 50)}...`);
            successCount++;
          } else {
            console.error(`  ✗ Error: ${e.message}`);
            console.error(`    Statement: ${stmt.substring(0, 80)}...`);
            errorCount++;
          }
        }
      }
      
      console.log(`\n✓ Ejecutadas ${successCount}/${statements.length} sentencias (${errorCount} errores ignorados)`);
    }

    // Verify functions exist
    console.log('\nVerificando funciones RPC...');
    
    const checkQuery = `
      SELECT routine_name FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN (
        'claim_profile_descriptions_work',
        'read_profile_description_context',
        'save_profile_descriptions'
      )
    `;
    
    const result = await client.query(checkQuery);
    console.log(`✓ Encontradas ${result.rows.length}/3 funciones:`);
    result.rows.forEach(r => console.log(`  - ${r.routine_name}`));

    // Verify table exists
    const tableQuery = `
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'user_profile_descriptions'
      )
    `;
    
    const tableResult = await client.query(tableQuery);
    if (tableResult.rows[0].exists) {
      console.log('✓ Tabla user_profile_descriptions existe');
    } else {
      console.log('✗ Tabla user_profile_descriptions NO existe');
    }

    await client.end();
    console.log('\n✓ Completado');
    process.exit(0);
  } catch (error) {
    console.error('Error fatal:', error.message);
    if (client) {
      try {
        await client.end();
      } catch (e) {
        // ignore
      }
    }
    process.exit(1);
  }
}

main();
