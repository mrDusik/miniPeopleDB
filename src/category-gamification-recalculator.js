import { createHash } from 'node:crypto';
import { watch } from 'node:fs';
import { basename, dirname } from 'node:path';
import { calcularGamificacion, DNA_PONDERACIONES, OBJETIVOS } from './gamificacion.js';

const PAGE_SIZE = 1000;
const SOURCES_RPC = 'leer_recalculo_gamificacion_categorias';
const APPLY_RPC = 'aplicar_recalculo_gamificacion_categorias';
const GAMIFICATION_FINGERPRINT_VERSION = 'v2.1';

export function fingerprint(categorias) {
  const pesosDna = [...DNA_PONDERACIONES].sort(([left], [right]) => left.localeCompare(right));
  return createHash('sha256').update(JSON.stringify({
    version: GAMIFICATION_FINGERPRINT_VERSION,
    categorias,
    objetivos: OBJETIVOS,
    pesosDna,
  })).digest('hex');
}

async function readRecalculationSources(client, currentFingerprint) {
  const users = [];
  const figures = [];
  const socialSources = [];
  let cursor = null;
  let appliedFingerprint = null;
  let firstPage = true;

  while (true) {
    const { data, error } = await client.rpc(SOURCES_RPC, {
      p_after_user_id: cursor,
      p_limit: PAGE_SIZE,
    });
    if (error || !data || typeof data !== 'object' || Array.isArray(data)
      || data.version !== 'v2' || typeof data.fingerprint !== 'string'
      || !Array.isArray(data.users) || !Array.isArray(data.figures) || !Array.isArray(data.social_sources)
      || typeof data.has_more !== 'boolean') {
      throw new Error('No se pudieron leer las fuentes mínimas para recalcular gamificación');
    }

    if (firstPage) {
      appliedFingerprint = data.fingerprint;
      if (appliedFingerprint === currentFingerprint) return { appliedFingerprint, recalculatedSources: false };
      firstPage = false;
    } else if (data.fingerprint !== appliedFingerprint) {
      throw new Error('Cambió la versión aplicada durante la paginación del recálculo');
    }

    users.push(...data.users);
    figures.push(...data.figures);
    socialSources.push(...data.social_sources);
    if (!data.has_more) break;
    if (typeof data.next_cursor !== 'string' || data.next_cursor === cursor || data.users.length === 0) {
      throw new Error('La paginación de fuentes de gamificación no avanzó');
    }
    cursor = data.next_cursor;
  }

  return { appliedFingerprint, recalculatedSources: true, users, figures, socialSources };
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
    const sources = await readRecalculationSources(this.client, currentFingerprint);
    if (!sources.recalculatedSources) {
      return { recalculated: false, users: 0, fingerprint: currentFingerprint };
    }

    const userIds = new Set(sources.users.filter((userId) => typeof userId === 'string' && userId !== ''));
    const socialByUser = new Map(sources.socialSources.map((source) => [source.user_id, source]));
    const figuresByUser = new Map();
    for (const figure of sources.figures) {
      if (!figuresByUser.has(figure.user_id)) figuresByUser.set(figure.user_id, []);
      figuresByUser.get(figure.user_id).push({
        id: figure.id,
        nombreCompleto: figure.nombreCompleto ?? undefined,
        categoria: figure.categoria,
        subcategoria: figure.subcategoria ?? undefined,
        anio: figure.anio ?? undefined,
        estadoColeccion: figure.estado_coleccion,
        precio: figure.precio ?? undefined,
        precioCompra: figure.precio_compra ?? undefined,
      });
    }

    const states = [...userIds].sort().map((userId) => {
      const socialSources = socialByUser.get(userId);
      if (!socialSources) throw new Error('Falta el contexto social de un usuario paginado');
      const state = calcularGamificacion(
        figuresByUser.get(userId) || [], categorias,
        socialSources.global_gifts_received,
        socialSources.thanks_received,
        socialSources.weekly_gifts_received,
        socialSources,
      );
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
      p_version: 'v2',
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