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

function formatDuration(durationMs) {
  const totalMs = Math.max(0, Math.trunc(durationMs));
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}s`;
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
    const startedAtMs = now();
    const metrics = {
      claimWaitMs: 0,
      distinctPriceIds: 0,
      bricksetRequests: 0,
      bricksetSuccesses: 0,
      bricksetFailures: 0,
      unavailablePrices: 0,
      unavailablePriceIds: [],
      bricksetDurationMs: 0,
      failedPrices: 0,
      totalUsers: 0,
      processedUsers: 0,
      failedUsers: 0,
      pricePhaseMs: 0,
      snapshotPhaseMs: 0,
    };
    const leaseOwner = randomUUID();
    let leaseLost = false;
    let heartbeatPending = false;
    let claimed = false;
    let outcome = 'failed';
    let errorCode = 'WORKER_ERROR';
    while (!closed && !claimed) {
      claimed = await retryStorage(() => repository.claim(run.jobId, leaseOwner, leaseSeconds));
      if (claimed) break;

      const current = await retryStorage(() => repository.status(run.jobId));
      if (!current || !['pending', 'running'].includes(current.status)) return;
      await sleepImpl(claimRetryMs);
    }
    if (!claimed || closed) return;
    metrics.claimWaitMs = Math.max(0, now() - startedAtMs);
    logger.info('[daily-analytics] inicio', JSON.stringify({
      jobId: run.jobId,
      snapshotDate: run.snapshotDate,
      startedAt: new Date(startedAtMs).toISOString(),
    }));

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
      const pricePhaseStartedAtMs = now();
      let afterFigureId = null;
      while (true) {
        ensureLease();
        const page = await retryStorage(() => repository.pricesPage(run.jobId, leaseOwner, afterFigureId, pageSize));
        if (!Array.isArray(page)) throw new Error('Invalid price page');
        metrics.distinctPriceIds += page.length;
        for (const { figure_id: figureId } of page) {
          ensureLease();
          let result;
          const controller = new AbortController();
          activeRequests.add(controller);
          metrics.bricksetRequests += 1;
          const requestStartedAtMs = now();
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
              : price === null
                ? { success: false, failureCode: 'PRICE_NOT_KNOWN' }
              : { success: false, failureCode: 'INVALID_RESPONSE' };
          } catch (error) {
            result = { success: false, failureCode: scraperFailureCode(error) };
          } finally {
            metrics.bricksetDurationMs += Math.max(0, now() - requestStartedAtMs);
            activeRequests.delete(controller);
          }
          if (result.success) {
            metrics.bricksetSuccesses += 1;
          } else if (result.failureCode === 'PRICE_NOT_KNOWN') {
            metrics.unavailablePrices += 1;
            metrics.unavailablePriceIds.push(figureId);
            logger.warn?.('[daily-analytics] Brickset indica precio "Not known"; se reintentará en próximos trabajos', figureId);
          } else {
            metrics.bricksetFailures += 1;
          }
          ensureLease();
          await retryStorage(() => repository.applyPrice(run.jobId, leaseOwner, figureId, result));
        }
        if (page.length < pageSize) break;
        afterFigureId = page.at(-1).figure_id;
      }
      metrics.pricePhaseMs = Math.max(0, now() - pricePhaseStartedAtMs);

      const snapshotPhaseStartedAtMs = now();
      let afterUserId = null;
      while (true) {
        ensureLease();
        const page = await retryStorage(() => repository.usersPage(run.jobId, leaseOwner, afterUserId, pageSize));
        if (!Array.isArray(page)) throw new Error('Invalid user page');
        metrics.totalUsers += page.length;
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
            })), categorias, sources.giftsReceived, sources.thanksReceived ?? 0, sources.weeklyGiftsReceived ?? 0);
            ensureLease();
            captured = await retryStorage(() => repository.captureUser(run.jobId, leaseOwner, userId, sources.revision, {
              bricks: state.bricks,
              nivel: state.nivel,
              siguiente_nivel: state.siguienteNivel,
              progreso: state.progreso,
              logros: state.logros,
            }));
          }
          if (captured) {
            metrics.processedUsers += 1;
          } else {
            metrics.failedUsers += 1;
            ensureLease();
            await retryStorage(() => repository.failUser(run.jobId, leaseOwner, userId, 'MAX_RETRIES'));
          }
        }
        if (page.length < pageSize) break;
        afterUserId = page.at(-1).user_id;
      }
      metrics.snapshotPhaseMs = Math.max(0, now() - snapshotPhaseStartedAtMs);

      ensureLease();
      const finalStatus = await retryStorage(() => repository.finalize(run.jobId, leaseOwner));
      outcome = finalStatus?.status ?? 'completed';
      errorCode = finalStatus?.errorCode ?? null;
      metrics.failedPrices = Number.isFinite(finalStatus?.failedPrices)
        ? finalStatus.failedPrices
        : metrics.bricksetFailures;
    } catch (error) {
      if (error?.code === 'DAILY_SYNC_LEASE_CADUCADO') {
        outcome = 'lease_lost';
        errorCode = error.code;
      } else if (closed) {
        outcome = 'interrupted';
        errorCode = 'WORKER_INTERRUPTED';
      }
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
      const finishedAtMs = now();
      const durationMs = Math.max(0, finishedAtMs - startedAtMs);
      logger.info('[daily-analytics] resumen', JSON.stringify({
        jobId: run.jobId,
        snapshotDate: run.snapshotDate,
        status: outcome,
        errorCode,
        startedAt: new Date(startedAtMs).toISOString(),
        finishedAt: new Date(finishedAtMs).toISOString(),
        duration: formatDuration(durationMs),
        claimWait: formatDuration(metrics.claimWaitMs),
        pricePhase: formatDuration(metrics.pricePhaseMs),
        snapshotPhase: formatDuration(metrics.snapshotPhaseMs),
        distinctPriceIds: metrics.distinctPriceIds,
        bricksetRequests: metrics.bricksetRequests,
        bricksetSuccesses: metrics.bricksetSuccesses,
        bricksetFailures: metrics.bricksetFailures,
        unavailablePrices: metrics.unavailablePrices,
        unavailablePriceIds: metrics.unavailablePriceIds,
        failedPrices: metrics.failedPrices,
        averageBricksetTime: metrics.bricksetRequests
          ? formatDuration(metrics.bricksetDurationMs / metrics.bricksetRequests)
          : null,
        totalUsers: metrics.totalUsers,
        processedUsers: metrics.processedUsers,
        failedUsers: metrics.failedUsers,
      }));
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