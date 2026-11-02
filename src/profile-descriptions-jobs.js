/**
 * Profile descriptions worker: Durable, paginable, idempotent batch job
 * Runs once per Sunday to generate and update profile description variants.
 *
 * Features:
 * - Lease-based claiming for concurrency control
 * - Pagination with deterministic ordering
 * - Retry logic with exponential backoff for transient failures
 * - Graceful handling of lease expiration and recovery
 * - Telemetry without exposing private data
 */

import { ProfileDescriptionsRepository } from './profile-descriptions-repository.js';
import {
  composeDescriptions,
  generateContextFingerprint,
  shouldRegenerateDescription,
} from './profile-descriptions-composer.js';

export class ProfileDescriptionsWorker {
  constructor(supabaseClient, options = {}) {
    this.supabase = supabaseClient;
    this.repository = new ProfileDescriptionsRepository(supabaseClient);
    this.batchSize = options.batchSize || 50;
    this.leaseDurationMinutes = options.leaseDurationMinutes || 30;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMs = options.retryDelayMs || 1000;
    this.dnaChangeThreshold = options.dnaChangeThreshold || 5;
  }

  /**
   * Execute the weekly batch: claim, process, and save descriptions.
   * Designed to be called once per Sunday by an external scheduler.
   *
   * @returns {Promise<Object>} - { processed: number, succeeded: number, failed: number, errors: [] }
   */
  async run() {
    const stats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      skipped: 0,
      startedAt: new Date(),
    };

    try {
      let hasMore = true;
      while (hasMore) {
        const batch = await this.repository.claimWork(this.batchSize, this.leaseDurationMinutes);

        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        for (const claim of batch) {
          await this.processUser(claim, stats);
        }

        // If we received fewer than batchSize, this was the last batch
        if (batch.length < this.batchSize) {
          hasMore = false;
        }
      }
    } catch (error) {
      stats.errors.push({
        phase: 'batch',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    stats.completedAt = new Date();
    stats.durationMs = stats.completedAt - stats.startedAt;

    return stats;
  }

  /**
   * Process a single user: read context, generate descriptions, save results.
   * @private
   */
  async processUser(claim, stats) {
    const { user_id: userId, lease_id: leaseId } = claim;
    stats.processed += 1;

    let retryCount = 0;
    let lastError = null;

    while (retryCount < this.maxRetries) {
      try {
        // Read current context
        const context = await this.repository.readContext(userId, leaseId);
        if (!context) {
          stats.failed += 1;
          stats.errors.push({
            userId,
            phase: 'read_context',
            message: 'Context unavailable',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        // Build context object for composer
        const userContext = {
          level: context.level || 0,
          dnaPercentages: {
            explorer: context.dna_explorer || 0,
            collector: context.dna_collector || 0,
            fan: context.dna_fan || 0,
            rarityHunter: context.dna_rarity_hunter || 0,
          },
          achievements: {
            ids: context.achievement_ids || [],
            counts: context.achievement_counts || {},
            highlighted: context.achievement_highlighted || [],
          },
          recentFigures: {
            collection: context.recent_collection_ids?.map(id => ({ id })) || [],
            searching: context.recent_searching_ids?.map(id => ({ id })) || [],
          },
          favoriteCategories: context.favorite_category_ids || [],
        };

        // Check if regeneration is needed
        // Note: context.private_snapshot is used here, but the RPC does not expose it
        // For this phase, we assume the RPC will be updated to return it for comparison
        const shouldRegen = shouldRegenerateDescription(userContext, null, {
          dnaChangeThreshold: this.dnaChangeThreshold,
        });

        if (!shouldRegen.shouldRegenerate) {
          stats.skipped += 1;
          return;
        }

        // Compose descriptions
        const descriptions = composeDescriptions(userContext);
        if (!descriptions.own && !descriptions.public) {
          stats.skipped += 1;
          return;
        }

        // Generate fingerprint for future comparisons
        const fingerprint = generateContextFingerprint(userContext);

        // Save atomically
        const saveResult = await this.repository.saveDescriptions(
          userId,
          leaseId,
          descriptions.own,
          descriptions.public,
          descriptions.templateVersion,
          fingerprint,
          userContext,
        );

        if (saveResult.success) {
          stats.succeeded += 1;
          return;
        } else {
          throw new Error(saveResult.error || 'Save failed');
        }
      } catch (error) {
        lastError = error;
        retryCount += 1;

        if (retryCount < this.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          await this.sleep(this.retryDelayMs * Math.pow(2, retryCount - 1));
        }
      }
    }

    // Failed after all retries
    stats.failed += 1;
    stats.errors.push({
      userId,
      phase: 'process',
      message: lastError?.message || 'Unknown error',
      retries: retryCount,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Sleep helper for retry delays.
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Telemetry: log summary statistics without exposing private data.
 * @param {Object} stats - from worker.run()
 */
export function logWorkerTelemetry(stats) {
  const summary = {
    duration_minutes: Math.round(stats.durationMs / 60000),
    processed: stats.processed,
    succeeded: stats.succeeded,
    skipped: stats.skipped,
    failed: stats.failed,
    error_count: stats.errors.length,
    started_at: stats.startedAt.toISOString(),
    completed_at: stats.completedAt?.toISOString(),
  };

  // Log summary (no private descriptions, snapshots, or leases)
  console.log('Profile descriptions worker telemetry:', JSON.stringify(summary));

  // Log error summary (no PII, just phases and counts)
  if (stats.errors.length > 0) {
    const errorsByPhase = {};
    for (const err of stats.errors) {
      const phase = err.phase || 'unknown';
      errorsByPhase[phase] = (errorsByPhase[phase] || 0) + 1;
    }
    console.log('Errors by phase:', JSON.stringify(errorsByPhase));
  }

  return summary;
}
