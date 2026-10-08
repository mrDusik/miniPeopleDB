import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminConfig } from './services/supabase.js';

const RPC_OPTIONS = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};

export class DailyAnalyticsRepositoryError extends Error {
  constructor() {
    super('El almacenamiento de analitica diaria no esta disponible');
    this.name = 'DailyAnalyticsRepositoryError';
    this.code = 'ANALITICA_NO_DISPONIBLE';
  }
}

export class DailyAnalyticsRepository {
  constructor({ client } = {}) {
    if (!client || typeof client.rpc !== 'function') throw new DailyAnalyticsRepositoryError();
    this.client = client;
  }

  async call(name, parameters = {}) {
    try {
      const { data, error } = await this.client.rpc(name, parameters);
      if (error) throw error;
      return data;
    } catch {
      throw new DailyAnalyticsRepositoryError();
    }
  }

  start() {
    return this.call('iniciar_daily_sync');
  }

  recover() {
    return this.call('recuperar_daily_sync');
  }

  status(runId) {
    return this.call('consultar_daily_sync', { p_run_id: runId });
  }

  claim(runId, leaseOwner, leaseSeconds = 120) {
    return this.call('reclamar_daily_sync', {
      p_run_id: runId,
      p_lease_owner: leaseOwner,
      p_lease_seconds: leaseSeconds,
    });
  }

  renew(runId, leaseOwner, leaseSeconds = 120) {
    return this.call('renovar_daily_sync', {
      p_run_id: runId,
      p_lease_owner: leaseOwner,
      p_lease_seconds: leaseSeconds,
    });
  }

  usersPage(runId, leaseOwner, afterUserId = null, limit = 1000) {
    return this.call('leer_daily_sync_usuarios', {
      p_run_id: runId,
      p_lease_owner: leaseOwner,
      p_after_user_id: afterUserId,
      p_limit: limit,
    });
  }

  pricesPage(runId, leaseOwner, afterFigureId = null, limit = 1000) {
    return this.call('leer_daily_sync_precios', {
      p_run_id: runId,
      p_lease_owner: leaseOwner,
      p_after_figure_id: afterFigureId,
      p_limit: limit,
    });
  }

  applyPrice(runId, leaseOwner, figureId, result) {
    return this.call('aplicar_daily_sync_precio', {
      p_run_id: runId,
      p_lease_owner: leaseOwner,
      p_figure_id: figureId,
      p_success: result.success,
      p_price: result.price ?? null,
      p_failure_code: result.failureCode ?? null,
    });
  }

  sources(runId, leaseOwner, userId) {
    return this.call('leer_daily_sync_fuentes', {
      p_run_id: runId,
      p_lease_owner: leaseOwner,
      p_user_id: userId,
    });
  }

  captureUser(runId, leaseOwner, userId, expectedRevision, state) {
    return this.call('capturar_daily_sync_usuario', {
      p_run_id: runId,
      p_lease_owner: leaseOwner,
      p_user_id: userId,
      p_expected_revision: expectedRevision,
      p_state: state,
    });
  }

  failUser(runId, leaseOwner, userId, errorCode) {
    return this.call('fallar_daily_sync_usuario', {
      p_run_id: runId,
      p_lease_owner: leaseOwner,
      p_user_id: userId,
      p_error_code: errorCode,
    });
  }

  finalize(runId, leaseOwner) {
    return this.call('finalizar_daily_sync', { p_run_id: runId, p_lease_owner: leaseOwner });
  }

  fail(runId, leaseOwner, errorCode) {
    return this.call('fallar_daily_sync', {
      p_run_id: runId,
      p_lease_owner: leaseOwner,
      p_error_code: errorCode,
    });
  }
}

export function createDailyAnalyticsRepository({
  adminConfig = getSupabaseAdminConfig(),
  createSupabaseClient = createClient,
} = {}) {
  if (!adminConfig) throw new DailyAnalyticsRepositoryError();
  const client = createSupabaseClient(adminConfig.url, adminConfig.serviceRoleKey, {
    auth: RPC_OPTIONS,
  });
  return new DailyAnalyticsRepository({ client });
}