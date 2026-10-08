const TABLE = 'user_daily_snapshots';
const HISTORY_COLUMNS = [
  'snapshot_date',
  'total_figures',
  'total_value',
  'bricks',
  'level',
  'pct_collector',
  'pct_explorer',
  'pct_rarity_hunter',
  'pct_fan',
].join(',');

export class HistoricoNoDisponibleError extends Error {
  constructor() {
    super('El historico no esta disponible');
    this.name = 'HistoricoNoDisponibleError';
    this.code = 'HISTORICO_NO_DISPONIBLE';
  }
}

function finiteNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new HistoricoNoDisponibleError();
  return number;
}

function projectSnapshot(row) {
  return {
    snapshotDate: row.snapshot_date,
    totalFigures: finiteNumber(row.total_figures),
    totalValue: finiteNumber(row.total_value),
    bricks: finiteNumber(row.bricks),
    level: finiteNumber(row.level),
    dna: {
      collector: finiteNumber(row.pct_collector),
      explorer: finiteNumber(row.pct_explorer),
      rarityHunter: finiteNumber(row.pct_rarity_hunter),
      fan: finiteNumber(row.pct_fan),
    },
  };
}

export class DailyAnalyticsHistoryRepository {
  constructor({ client } = {}) {
    this.client = client;
  }

  async readRange(from, to) {
    try {
      const [history, previous] = await Promise.all([
        this.client.from(TABLE)
          .select(HISTORY_COLUMNS)
          .gte('snapshot_date', from)
          .lte('snapshot_date', to)
          .order('snapshot_date', { ascending: true }),
        this.client.from(TABLE)
          .select('snapshot_date,total_figures')
          .lt('snapshot_date', from)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (history.error || previous.error || !Array.isArray(history.data)) throw new HistoricoNoDisponibleError();
      return {
        snapshots: history.data.map(projectSnapshot),
        baseline: previous.data ? {
          snapshotDate: previous.data.snapshot_date,
          totalFigures: finiteNumber(previous.data.total_figures),
        } : null,
      };
    } catch {
      throw new HistoricoNoDisponibleError();
    }
  }
}