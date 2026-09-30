import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Pega aqui el UID (auth.users.id) al que se asignaran todas las filas migradas.
const TARGET_USER_ID = '5617ba6b-1356-476e-a4aa-b8af13f82853';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MINIFIGURAS_PATH = resolve(projectRoot, 'data', 'minifiguras.json');
const GAMIFICACION_PATH = resolve(projectRoot, 'data', 'gamificacion.json');
const BATCH_SIZE = 100;

dotenv.config({ path: resolve(projectRoot, 'sup.env') });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function toMinifiguraRow(minifigura) {
  return {
    user_id: TARGET_USER_ID,
    id: minifigura.id,
    nombre: minifigura.nombre,
    descripcion: minifigura.descripcion ?? null,
    categoria: minifigura.categoria,
    subcategoria: minifigura.subcategoria ?? null,
    anio: minifigura.anio ?? null,
    estado_coleccion: minifigura.estadoColeccion,
    precio_compra: minifigura.precioCompra ?? null,
    fecha_compra: minifigura.fechaCompra ?? null,
    precio: minifigura.precio ?? null,
    fecha_registro: minifigura.FechaRegistro ?? new Date().toISOString(),
    observada: minifigura.observada ?? false,
    updated_at: new Date().toISOString(),
  };
}

function toGamificacionRow(estado) {
  return {
    user_id: TARGET_USER_ID,
    bricks: estado.bricks,
    nivel: estado.nivel,
    siguiente_nivel: estado.siguienteNivel ?? null,
    progreso: estado.progreso,
    logros: estado.logros,
    updated_at: new Date().toISOString(),
  };
}

// La service_role key omite RLS, por eso cada fila fija user_id = TARGET_USER_ID.
function createServiceClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function migrateMinifiguras(client) {
  const catalogo = await readJson(MINIFIGURAS_PATH);
  if (!Array.isArray(catalogo)) {
    throw new Error('data/minifiguras.json debe contener un array');
  }

  for (let index = 0; index < catalogo.length; index += BATCH_SIZE) {
    const batch = catalogo.slice(index, index + BATCH_SIZE).map(toMinifiguraRow);
    const { error } = await client.from('minifiguras').upsert(batch, { onConflict: 'user_id,id' });
    if (error) {
      throw new Error(`Error al migrar minifiguras (lote ${index / BATCH_SIZE + 1}): ${error.message}`);
    }
  }
  return catalogo.length;
}

async function migrateGamificacion(client) {
  const estado = await readJson(GAMIFICACION_PATH);
  const { error } = await client.from('gamificacion').upsert(toGamificacionRow(estado), { onConflict: 'user_id' });
  if (error) {
    throw new Error(`Error al migrar gamificacion: ${error.message}`);
  }
}

export async function migrate() {
  if (!TARGET_USER_ID) {
    throw new Error('Define TARGET_USER_ID en scripts/migrate-json-to-supabase.js antes de ejecutar la migracion');
  }

  const client = createServiceClient();
  const total = await migrateMinifiguras(client);
  await migrateGamificacion(client);
  return total;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate()
    .then((total) => console.log(`Migracion completada: ${total} minifiguras y el estado de gamificacion.`))
    .catch((error) => {
      console.error(`[migrate-json-to-supabase] ${error.message}`);
      process.exitCode = 1;
    });
}
