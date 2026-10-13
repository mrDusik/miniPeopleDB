import { randomUUID } from 'node:crypto';
import { calcularGamificacion } from './gamificacion.js';

const LEASE_SECONDS = 120;
const HEARTBEAT_MS = 40000;
const PAGE_SIZE = 500;
const SOURCE_RETRIES = 3;
const SCRAPER_TIMEOUT_MS = 15000;

function scraperFailureCode(error) {
  if (error?.code === 'BRICKSET_TIMEOUT' || error?.name === 'AbortError') return 'TIMEOUT';
  if (error?.code === 'BRICKSET_LIMITE') return 'RATE_LIMIT';
  if (error?.code === 'BRICKSET_PRECIO_NO_DISPONIBLE' || error?.code === 'BRICKSET_DETALLES_NO_DISPONIBLES') return 'INVALID_RESPONSE';
  return 'SCRAPER_ERROR';
}

function withTimeout(promise, timeoutMs, setTimeoutImpl, clearTimeoutImpl, onTimeout) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeoutImpl(() => {
      onTimeout();
      reject(Object.assign(new Error('Scraper timeout'), { code: 'BRICKSET_TIMEOUT' }));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeoutImpl(timer));
}

export function createDailyAnalyticsJobs({
  repository,
  brickset,
  categoriasRepository,
  now = Date.now,
  setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  sleepImpl = (duration) => new Promise((resolve) => setTimeoutImpl(resolve, duration)),
  leaseSeconds = LEASE_SECONDS,
  heartbeatMs = HEARTBEAT_MS,
  claimRetryMs = HEARTBEAT_MS,
  pageSize = PAGE_SIZE,
  sourceRetries = SOURCE_RETRIES,
  storageRetryDelaysMs = [250, 500, 1000],
  scraperTimeoutMs = SCRAPER_TIMEOUT_MS,
  logger = console,
} = {}) {
  const workers = new Map();
  const heartbeats = new Set();
  const activeRequests = new Set();
  let closed = false;

  async function retryStorage(operation) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const delay = storageRetryDelaysMs[attempt];
        if (delay === undefined || closed) {
          throw Object.assign(new Error('Daily analytics storage retry limit reached'), {
            code: 'DAILY_SYNC_MAX_RETRIES',
            cause: error,
          });
        }
        await sleepImpl(delay);
      }
    }
  }

  function schedule(run) {
    if (!run?.jobId || workers.has(run.jobId) || closed) return workers.get(run?.jobId);
    const worker = process(run)
      .catch(() => logger.error('[daily-analytics] No se pudo recuperar el trabajo persistido'))
      .finally(() => workers.delete(run.jobId));
    workers.set(run.jobId, worker);
    return worker;
  }

  async function process(run) {
    const leaseOwner = randomUUID();
    let leaseLost = false;
    let heartbeatPending = false;
    let claimed = false;
    while (!closed && !claimed) {
      claimed = await retryStorage(() => repository.claim(run.jobId, leaseOwner, leaseSeconds));
      if (claimed) break;

      const current = await retryStorage(() => repository.status(run.jobId));
      if (!current || !['pending', 'running'].includes(current.status)) return;
      await sleepImpl(claimRetryMs);
    }
    if (!claimed || closed) return;

    const heartbeat = setIntervalImpl(async () => {
      if (heartbeatPending || leaseLost || closed) return;
      heartbeatPending = true;
      try {
        leaseLost = !(await retryStorage(() => repository.renew(run.jobId, leaseOwner, leaseSeconds)));
      } catch {
        leaseLost = true;
      } finally {
        heartbeatPending = false;
      }
    }, heartbeatMs);
    heartbeats.add(heartbeat);
    heartbeat?.unref?.();

    const ensureLease = () => {
      if (leaseLost || closed) throw Object.assign(new Error('Worker lease unavailable'), { code: 'DAILY_SYNC_LEASE_CADUCADO' });
    };

    try {
      let afterFigureId = null;
      while (true) {
        ensureLease();
        const page = await retryStorage(() => repository.pricesPage(run.jobId, leaseOwner, afterFigureId, pageSize));
        if (!Array.isArray(page)) throw new Error('Invalid price page');
        for (const { figure_id: figureId } of page) {
          ensureLease();
          let result;
          const controller = new AbortController();
          activeRequests.add(controller);
          try {
            const price = await withTimeout(
              brickset.getPrice(figureId, { signal: controller.signal }),
              scraperTimeoutMs,
              setTimeoutImpl,
              clearTimeoutImpl,
              () => controller.abort(),
            );
            result = Number.isFinite(price) && price >= 0
              ? { success: true, price }
              : { success: false, failureCode: 'INVALID_RESPONSE' };
          } catch (error) {
            result = { success: false, failureCode: scraperFailureCode(error) };
          } finally {
            activeRequests.delete(controller);
          }
          ensureLease();
          await retryStorage(() => repository.applyPrice(run.jobId, leaseOwner, figureId, result));
        }
        if (page.length < pageSize) break;
        afterFigureId = page.at(-1).figure_id;
      }

      let afterUserId = null;
      while (true) {
        ensureLease();
        const page = await retryStorage(() => repository.usersPage(run.jobId, leaseOwner, afterUserId, pageSize));
        if (!Array.isArray(page)) throw new Error('Invalid user page');
        for (const { user_id: userId } of page) {
          ensureLease();
          let captured = false;
          for (let attempt = 0; attempt < sourceRetries && !captured; attempt += 1) {
            ensureLease();
            const [sources, categorias] = await Promise.all([
              retryStorage(() => repository.sources(run.jobId, leaseOwner, userId)),
              categoriasRepository.read(),
            ]);
            const state = calcularGamificacion(sources.figures.map((figure) => ({
              id: figure.id,
              categoria: figure.categoria,
              subcategoria: figure.subcategoria ?? undefined,
              anio: figure.anio ?? undefined,
              estadoColeccion: figure.estadoColeccion,
              precio: figure.precio ?? undefined,
              precioCompra: figure.precioCompra ?? undefined,
            })), categorias, sources.giftsReceived, sources.thanksReceived ?? 0);
            ensureLease();
            captured = await retryStorage(() => repository.captureUser(run.jobId, leaseOwner, userId, sources.revision, {
              bricks: state.bricks,
              nivel: state.nivel,
              siguiente_nivel: state.siguienteNivel,
              progreso: state.progreso,
              logros: state.logros,
            }));
          }
          if (!captured) {
            ensureLease();
            await retryStorage(() => repository.failUser(run.jobId, leaseOwner, userId, 'MAX_RETRIES'));
          }
        }
        if (page.length < pageSize) break;
        afterUserId = page.at(-1).user_id;
      }

      ensureLease();
      await retryStorage(() => repository.finalize(run.jobId, leaseOwner));
    } catch (error) {
      if (error?.code !== 'DAILY_SYNC_LEASE_CADUCADO' && !closed) {
        try {
          await repository.fail(run.jobId, leaseOwner, 'WORKER_ERROR');
        } catch {
          logger.error('[daily-analytics] No se pudo guardar el estado de error');
        }
      }
      if (error?.code !== 'DAILY_SYNC_LEASE_CADUCADO' && !closed) {
        logger.error('[daily-analytics] El trabajo diario no pudo completarse');
      }
    } finally {
      clearIntervalImpl(heartbeat);
      heartbeats.delete(heartbeat);
    }
  }

  return {
    async start() {
      const run = await repository.start();
      schedule(run);
      return run;
    },
    async recover() {
      const run = await repository.recover();
      if (run) schedule(run);
      return run;
    },
    status(runId) {
      return repository.status(runId);
    },
    close() {
      closed = true;
      for (const heartbeat of heartbeats) clearIntervalImpl(heartbeat);
      heartbeats.clear();
      for (const controller of activeRequests) controller.abort();
      activeRequests.clear();
    },
    async waitForIdle() {
      await Promise.allSettled([...workers.values()]);
    },
  };
}