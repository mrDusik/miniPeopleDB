import { createHash } from 'node:crypto';
import { watch } from 'node:fs';
import { basename, dirname } from 'node:path';
import { calcularGamificacion, OBJETIVOS } from './gamificacion.js';

const PAGE_SIZE = 1000;
const VERSION_TABLE = 'gamificacion_categoria_version';
const APPLY_RPC = 'aplicar_recalculo_gamificacion_categorias';

async function readAll(client, table, columns) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.from(table).select(columns).range(offset, offset + PAGE_SIZE - 1);
    if (error || !Array.isArray(data)) {
      throw new Error(`No se pudo leer ${table} para recalcular gamificación`);
    }
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

function fingerprint(categorias) {
  return createHash('sha256').update(JSON.stringify({ categorias, objetivos: OBJETIVOS })).digest('hex');
}

export class CategoryGamificationRecalculator {
  constructor({ client, categoriasRepository, filePath, watchImpl = watch, debounceMs = 250, logger = console } = {}) {
    this.client = client;
    this.categoriasRepository = categoriasRepository;
    this.filePath = filePath ?? categoriasRepository?.filePath;
    this.watchImpl = watchImpl;
    this.debounceMs = debounceMs;
    this.retryDelayMs = 5000;
    this.logger = logger;
    this.watcher = null;
    this.timer = null;
    this.running = null;
    this.rerun = false;
  }

  async recalculateIfChanged() {
    const categorias = await this.categoriasRepository.read();
    const currentFingerprint = fingerprint(categorias);
    const { data: version, error: versionError } = await this.client
      .from(VERSION_TABLE)
      .select('fingerprint')
      .eq('singleton', true)
      .maybeSingle();
    if (versionError) throw new Error('No se pudo leer la versión de categorías aplicada en Supabase');
    if (version?.fingerprint === currentFingerprint) {
      return { recalculated: false, users: 0, fingerprint: currentFingerprint };
    }

    const [gamificationRows, figureRows, gifts] = await Promise.all([
      readAll(this.client, 'gamificacion', 'user_id'),
      readAll(this.client, 'minifiguras', 'user_id,id,categoria,subcategoria,estado_coleccion,precio,precio_compra'),
      readAll(this.client, 'regalos_enviados', 'receptor_id'),
    ]);

    const userIds = new Set([
      ...gamificationRows.map(({ user_id }) => user_id),
      ...figureRows.map(({ user_id }) => user_id),
      ...gifts.map(({ receptor_id }) => receptor_id),
    ].filter((userId) => typeof userId === 'string' && userId !== ''));
    const figuresByUser = new Map();
    for (const figure of figureRows) {
      if (!figuresByUser.has(figure.user_id)) figuresByUser.set(figure.user_id, []);
      figuresByUser.get(figure.user_id).push({
        id: figure.id,
        categoria: figure.categoria,
        subcategoria: figure.subcategoria ?? undefined,
        estadoColeccion: figure.estado_coleccion,
        precio: figure.precio ?? undefined,
        precioCompra: figure.precio_compra ?? undefined,
      });
    }
    const giftsByUser = new Map();
    for (const { receptor_id: userId } of gifts) {
      giftsByUser.set(userId, (giftsByUser.get(userId) || 0) + 1);
    }

    const states = [...userIds].sort().map((userId) => {
      const state = calcularGamificacion(figuresByUser.get(userId) || [], categorias, giftsByUser.get(userId) || 0);
      return {
        user_id: userId,
        bricks: state.bricks,
        nivel: state.nivel,
        siguiente_nivel: state.siguienteNivel,
        progreso: state.progreso,
        logros: state.logros,
      };
    });

    const { data: applied, error } = await this.client.rpc(APPLY_RPC, {
      p_fingerprint: currentFingerprint,
      p_estados: states,
    });
    if (error) throw new Error('No se pudo guardar el recálculo global de gamificación');
    return { recalculated: applied === true, users: applied === true ? states.length : 0, fingerprint: currentFingerprint };
  }

  async reconcile() {
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = (async () => {
      let result;
      do {
        this.rerun = false;
        result = await this.recalculateIfChanged();
      } while (this.rerun);
      return result;
    })();
    try {
      return await this.running;
    } finally {
      this.running = null;
    }
  }

  async start() {
    if (this.watcher) return;
    this.watcher = this.watchImpl(dirname(this.filePath), (eventType, filename) => {
      if (filename !== null && filename.toString() !== basename(this.filePath)) return;
      this.schedule();
    });
    this.watcher.on('error', (error) => {
      this.logger.error(`[categorias-gamificacion] Error vigilando el JSON: ${error.message}`);
    });
    await this.reconcile();
  }

  schedule(delayMs = this.debounceMs) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.reconcile().catch((error) => {
        this.logger.error(`[categorias-gamificacion] ${error.message}`);
        if (!['CATEGORIAS_INVALIDOS', 'CATEGORIAS_NO_DISPONIBLES'].includes(error.code)) {
          this.schedule(this.retryDelayMs);
        }
      });
    }, delayMs);
    this.timer.unref?.();
  }

  close() {
    clearTimeout(this.timer);
    this.timer = null;
    this.watcher?.close();
    this.watcher = null;
  }
}