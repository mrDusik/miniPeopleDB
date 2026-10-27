import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { Client } from 'pg';
import { BricksetScraper } from '../src/brickset-scraper.js';
import { migrateGamificationV2, resolveBricksetFullNames } from '../src/gamification-v2-migration.js';

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const NO_BACKUP_TEST_PROJECT_REF = 'wvcnftjhvcdxmuqpjqda';

export function projectRefFromDatabaseUrl(connectionString) {
  let databaseUrl;
  try {
    databaseUrl = new URL(connectionString);
  } catch {
    throw new Error('SUPABASE_DB_URL no es una URL valida');
  }
  const directHost = /^db\.([a-z0-9]{20})\.supabase\.co$/i.exec(databaseUrl.hostname);
  if (directHost) return directHost[1].toLowerCase();
  const poolerUser = /^postgres\.([a-z0-9]{20})$/i.exec(decodeURIComponent(databaseUrl.username));
  if (poolerUser) return poolerUser[1].toLowerCase();
  throw new Error('No se pudo identificar el project ref en la URL de conexion PostgreSQL');
}

export function parseCutoverConfirmations(args) {
  const position = args.indexOf('--confirm-project');
  const value = position >= 0 ? args[position + 1] : null;
  if (typeof value !== 'string' || !PROJECT_REF_PATTERN.test(value)) {
    throw new Error('Uso: npm run migrate:gamification-v2 -- --confirm-project <project-ref> (--confirm-backup | --test-no-backup) --confirm-maintenance --confirm-catalog-coverage');
  }
  const confirmBackup = args.includes('--confirm-backup');
  const allowNoBackupForTest = args.includes('--test-no-backup');
  if (confirmBackup === allowNoBackupForTest) {
    throw new Error('Indica exactamente una opcion: --confirm-backup o --test-no-backup.');
  }
  if (allowNoBackupForTest && value !== NO_BACKUP_TEST_PROJECT_REF) {
    throw new Error('--test-no-backup solo se permite para el proyecto de pruebas confirmado.');
  }
  for (const flag of ['--confirm-maintenance', '--confirm-catalog-coverage']) {
    if (!args.includes(flag)) throw new Error(`Falta la confirmacion requerida ${flag}.`);
  }
  return { projectRef: value, confirmBackup, allowNoBackupForTest };
}

async function main() {
  dotenv.config({ path: fileURLToPath(new URL('../sup.env', import.meta.url)) });
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error('Falta SUPABASE_DB_URL; no se usan claves anon ni service_role para este corte.');
  const { projectRef, confirmBackup, allowNoBackupForTest } = parseCutoverConfirmations(process.argv.slice(2));
  const actualProjectRef = projectRefFromDatabaseUrl(connectionString);
  if (actualProjectRef !== projectRef) throw new Error('La confirmacion no coincide con el project ref de SUPABASE_DB_URL.');
  if (process.env.SUPABASE_URL) {
    const configuredProjectRef = new URL(process.env.SUPABASE_URL).hostname.split('.')[0].toLowerCase();
    if (configuredProjectRef !== projectRef) throw new Error('SUPABASE_URL y SUPABASE_DB_URL apuntan a proyectos distintos.');
  }

  const categorias = JSON.parse(await readFile(new URL('../data/categorias-brickset.json', import.meta.url), 'utf8'));
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const fullNamesById = await resolveBricksetFullNames({
      client,
      brickset: new BricksetScraper({ timeoutMs: 30000, retries: 2 }),
    });
    const result = await migrateGamificationV2({
      client,
      projectRef,
      categorias,
      fullNamesById,
      confirmBackup,
      allowNoBackupForTest,
      confirmMaintenance: true,
      confirmCatalogCoverage: true,
    });
    if (result.applied) {
      console.log(`Migracion V2 aplicada: ${result.users} cuentas, ${result.recoveredNames} nombres internos y ${result.migratedSubcategoryReferences} referencias de subcategoria migrados, availableFrom ${result.availableFrom}.`);
    } else {
      console.log('La migracion V2 ya estaba aplicada; no se modificaron datos.');
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}