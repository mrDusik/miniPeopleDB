import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { BricksetScraper } from '../src/brickset-scraper.js';

export function createCorrectionScraper(options = {}) {
  return new BricksetScraper({ timeoutMs: 30000, retries: 2, ...options });
}

export function correctionTarget(config, { apply = false, confirmProject } = {}) {
  const url = new URL(config.SUPABASE_URL);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)
    || url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.port) {
    throw new Error('SUPABASE_URL debe ser https://<project-ref>.supabase.co');
  }
  if (!config.SUPABASE_SERVICE_ROLE_KEY?.trim()) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');
  const projectRef = url.hostname.split('.')[0];
  if (apply && confirmProject !== projectRef) {
    throw new Error('Para escribir debes usar --apply --confirm-project <project-ref> del destino');
  }
  return { url: url.origin, serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY, projectRef };
}

export async function correctBricksetNames({ client, brickset, apply = false, pageSize = 500, ids, logger = console }) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error('pageSize invalido');
  if (ids !== undefined && (!Array.isArray(ids) || ids.length === 0
    || ids.some((id) => typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/i.test(id.trim())))) {
    throw new Error('La lista de IDs debe contener al menos un ID valido');
  }
  const selectedIds = ids === undefined ? null : new Set(ids.map((id) => id.trim().toUpperCase()));
  const summary = { mode: apply ? 'apply' : 'preview', processedIds: 0, updatedRows: 0, failedIds: [] };
  let afterId = null;
  const seen = new Set();
  while (true) {
    const { data: page, error } = await client.rpc('leer_correccion_nombres_brickset', {
      p_after_id: afterId, p_limit: pageSize,
    });
    if (error) throw new Error(`No se pudieron leer los IDs: ${error.code ?? 'RPC_ERROR'}`);
    if (!Array.isArray(page) || page.length > pageSize) throw new Error('Pagina de IDs invalida');
    for (const entry of page) {
      const id = entry?.id;
      if (typeof id !== 'string' || !id.trim() || seen.has(id)) throw new Error('ID vacio o repetido en la paginacion');
      seen.add(id);
      if (selectedIds && !selectedIds.has(id.trim().toUpperCase())) continue;
      summary.processedIds += 1;
      let fields;
      try {
        fields = await brickset.getNames(id);
        if (typeof fields?.nombre !== 'string' || !fields.nombre.trim()
          || (fields.descripcion !== null && typeof fields.descripcion !== 'string')) {
          throw new Error('BRICKSET_NOMBRE_INVALIDO');
        }
      } catch (scraperError) {
        summary.failedIds.push(id);
        logger.warn('[correct-brickset-names] sin cambios por fallo de Brickset', id, scraperError.code ?? 'SCRAPER_ERROR');
        continue;
      }
      if (!apply) {
        logger.info('[correct-brickset-names] propuesta', JSON.stringify({ id, ...fields }));
        continue;
      }
      const { data: count, error: updateError } = await client.rpc('aplicar_correccion_nombres_brickset', {
        p_id: id, p_nombre: fields.nombre, p_descripcion: fields.descripcion,
      });
      if (updateError || !Number.isSafeInteger(count) || count < 0) {
        throw new Error(`No se pudo confirmar la correccion de ${id}: ${updateError?.code ?? 'RPC_RESULT_INVALIDO'}`);
      }
      summary.updatedRows += count;
      logger.info('[correct-brickset-names] aplicado', JSON.stringify({ id, updatedRows: count }));
    }
    if (page.length < pageSize) break;
    afterId = page.at(-1).id;
  }
  logger.info('[correct-brickset-names] resumen', JSON.stringify(summary));
  return summary;
}

export async function runCli(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      'env-file': { type: 'string' },
      ids: { type: 'string' },
      apply: { type: 'boolean', default: false },
      'confirm-project': { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log('node scripts/correct-brickset-names.js --env-file <archivo> [--ids DIM030,ID2] [--apply --confirm-project <project-ref>]');
    return;
  }
  if (!values['env-file']) throw new Error('Indica --env-file con las credenciales del proyecto destino');
  const config = dotenv.parse(await readFile(resolve(values['env-file']), 'utf8'));
  const target = correctionTarget(config, { apply: values.apply, confirmProject: values['confirm-project'] });
  console.log('[correct-brickset-names] destino', target.url, values.apply ? 'APLICAR' : 'VISTA PREVIA SIN ESCRITURAS');
  const client = createClient(target.url, target.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return correctBricksetNames({
    client, brickset: createCorrectionScraper(), apply: values.apply,
    ids: values.ids === undefined ? undefined : values.ids.split(','),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().then((summary) => {
    if (summary?.failedIds.length) process.exitCode = 1;
  }).catch((error) => {
    console.error('[correct-brickset-names]', error.message);
    process.exitCode = 1;
  });
}