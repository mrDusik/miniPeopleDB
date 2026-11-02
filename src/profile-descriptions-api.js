/**
 * POST /api/cron/profile-descriptions
 * 
 * Trigger endpoint for the profile descriptions worker.
 * Protected by CRON_SECRET; designed to be called once per Sunday by an external scheduler.
 * 
 * Security:
 * - CRON_SECRET must match environment variable (not exposed in logs)
 * - Telemetry logged without private data (descriptions, snapshots, leases)
 * - No limit parameter exposure; batch size is fixed
 * 
 * Response: { success: boolean, stats: { processed, succeeded, failed, ... } }
 */

import { ProfileDescriptionsWorker, logWorkerTelemetry } from '../src/profile-descriptions-jobs.js';

export async function registerProfileDescriptionsRoutes(express, supabase) {
  // POST /api/cron/profile-descriptions
  // Authenticate via CRON_SECRET
  express.post('/api/cron/profile-descriptions', async (req, res) => {
    const cronSecret = req.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      return res.status(500).json({
        success: false,
        error: 'CRON_SECRET not configured',
      });
    }

    if (!cronSecret || cronSecret !== expectedSecret) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: invalid or missing CRON_SECRET',
      });
    }

    try {
      const worker = new ProfileDescriptionsWorker(supabase, {
        batchSize: 100, // Fixed batch size; not configurable per request
        leaseDurationMinutes: 30,
        maxRetries: 3,
        retryDelayMs: 1000,
        dnaChangeThreshold: 5,
      });

      const stats = await worker.run();
      const summary = logWorkerTelemetry(stats);

      return res.json({
        success: true,
        stats: summary,
      });
    } catch (error) {
      console.error('Profile descriptions worker error:', error.message);

      return res.status(500).json({
        success: false,
        error: error.message || 'Worker failed',
      });
    }
  });
}
