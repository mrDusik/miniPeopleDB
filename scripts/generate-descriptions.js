#!/usr/bin/env node

/**
 * Script para generar descripciones de perfil para usuarios de prueba
 * Ejecuta el worker de descripciones para todos los usuarios
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ProfileDescriptionsWorker, logWorkerTelemetry } from '../src/profile-descriptions-jobs.js';

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

    // Verify connection
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error('Error conectando a Supabase:', error.message);
      process.exit(1);
    }
    console.log(`✓ Conectado. Total de usuarios: ${data.users.length}`);

    // Reset leases (cleanup from previous attempts)
    console.log('\nLimpiando leases incompletos...');
    const { error: cleanError } = await supabase
      .from('user_profile_descriptions')
      .update({ 
        lease_id: null, 
        lease_expires_at: null 
      })
      .not('lease_id', 'is', null);
    
    if (cleanError && !cleanError.message.includes('does not exist')) {
      console.log('⚠ Aviso al limpiar:', cleanError.message);
    } else if (!cleanError) {
      console.log('✓ Leases limpiados');
    }

    // Create and run worker
    console.log('\nIniciando worker de descripciones...');
    const worker = new ProfileDescriptionsWorker(supabase, {
      batchSize: 50,
      leaseDurationMinutes: 30,
      maxRetries: 3,
      retryDelayMs: 1000,
      dnaChangeThreshold: 5,
    });

    const stats = await worker.run();

    // Log results
    console.log('\n=== Resultados ===');
    logWorkerTelemetry(stats);
    
    console.log('\nDetalle:');
    console.log(`  Procesados: ${stats.processed}`);
    console.log(`  Exitosos: ${stats.succeeded}`);
    console.log(`  Salteados: ${stats.skipped}`);
    console.log(`  Fallidos: ${stats.failed}`);
    console.log(`  Duración: ${Math.round(stats.durationMs / 1000)}s`);

    if (stats.errors.length > 0) {
      console.log('\nErrores:');
      stats.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.userId ? `Usuario ${err.userId}` : 'Batch'}: ${err.message} (fase: ${err.phase})`);
      });
    }

    process.exit(stats.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Error fatal:', error.message);
    process.exit(1);
  }
}

main();


