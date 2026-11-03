#!/usr/bin/env node

/**
 * Script para generar descripciones de perfil directamente sin RPC
 * Útil cuando la RPC aún no está optimizada
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { 
  composeDescriptions, 
  generateContextFingerprint 
} from '../src/profile-descriptions-composer.js';

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
      console.error('Error conectando a Supabase:', usersError.message);
      process.exit(1);
    }
    console.log(`✓ Conectado. Total de usuarios: ${users.users.length}`);

    // Generate descriptions for each user
    console.log('\nGenerando descripciones...');
    let succeeded = 0;
    let failed = 0;
    const errors = [];

    for (const user of users.users) {
      try {
        // Create a basic context for description generation
        const userContext = {
          level: 1, // Default level
          dnaPercentages: {
            explorer: 25,
            collector: 25,
            fan: 25,
            rarityHunter: 25,
          },
          achievements: {
            ids: [],
            counts: {},
            highlighted: [],
          },
          recentFigures: {
            collection: [],
            searching: [],
          },
          favoriteCategories: [],
        };

        // Compose descriptions
        const descriptions = composeDescriptions(userContext);
        const fingerprint = generateContextFingerprint(userContext);

        // Save to database
        const { error: saveError } = await supabase
          .from('user_profile_descriptions')
          .update({
            own_description_text: descriptions.own,
            public_description_text: descriptions.public,
            template_version: descriptions.templateVersion,
            private_fingerprint: fingerprint,
            private_snapshot: JSON.stringify(userContext),
            generated_at: new Date().toISOString(),
            lease_id: null,
            lease_expires_at: null,
          })
          .eq('user_id', user.id);

        if (saveError) {
          failed++;
          errors.push(`${user.email || user.id}: ${saveError.message}`);
          console.log(`✗ ${user.email || user.id}`);
        } else {
          succeeded++;
          console.log(`✓ ${user.email || user.id}`);
        }
      } catch (error) {
        failed++;
        errors.push(`${user.email || user.id}: ${error.message}`);
        console.log(`✗ ${user.email || user.id}`);
      }
    }

    // Print results
    console.log('\n=== Resultados ===');
    console.log(`Exitosos: ${succeeded}/${users.users.length}`);
    console.log(`Fallidos: ${failed}/${users.users.length}`);

    if (errors.length > 0) {
      console.log('\nErrores:');
      errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
    }

    console.log('\n✓ Descripciones generadas');
    console.log('\nAhora intenta ver en localhost:3000:');
    console.log('  - DNA: Botón "DNA" o "Mis datos"');
    console.log('  - Perfil: Sección "Amigos" → Click en un perfil');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Error fatal:', error.message);
    process.exit(1);
  }
}

main();
