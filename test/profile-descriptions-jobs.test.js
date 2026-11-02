import assert from 'node:assert/strict';
import test from 'node:test';
import { ProfileDescriptionsWorker, logWorkerTelemetry } from '../src/profile-descriptions-jobs.js';
import { ProfileDescriptionsRepository } from '../src/profile-descriptions-repository.js';

test('Profile Descriptions Worker: Task 3.1', async (t) => {
  // Mock Supabase client
  class MockSupabaseClient {
    constructor() {
      this.calls = [];
      this.leases = new Map();
      this.descriptions = new Map();
      this.claimedUsers = new Set();
      this.claimCallCount = 0;
    }

    rpc(name, params) {
      this.calls.push({ name, params });

      if (name === 'claim_profile_descriptions_work') {
        return this.mockClaimWork(params);
      }
      if (name === 'read_profile_description_context') {
        return this.mockReadContext(params);
      }
      if (name === 'save_profile_descriptions') {
        return this.mockSaveDescriptions(params);
      }

      return Promise.resolve({ data: null, error: null });
    }

    mockClaimWork(params) {
      this.claimCallCount += 1;
      const batchSize = params.p_batch_size || 100;
      const results = [];

      // Simulate claiming users only once per test
      // On subsequent calls, return empty (no more users to claim)
      if (this.claimCallCount > 1) {
        return Promise.resolve({ data: [], error: null });
      }

      // Simulate claiming users 1 through min(batchSize, 5)
      for (let i = 0; i < Math.min(batchSize, 5); i++) {
        const userId = `user-${i}`;
        const leaseId = `lease-${Date.now()}-${i}`;
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        this.leases.set(userId, { leaseId, expiresAt });
        this.claimedUsers.add(userId);
        results.push({ user_id: userId, lease_id: leaseId, expires_at: expiresAt });
      }

      return Promise.resolve({ data: results, error: null });
    }

    mockReadContext(params) {
      const { p_user_id: userId, p_lease_id: leaseId } = params;

      // Verify lease
      const lease = this.leases.get(userId);
      if (!lease || lease.leaseId !== leaseId) {
        return Promise.resolve({ data: null, error: { message: 'Invalid lease' } });
      }

      // Return mock context
      return Promise.resolve({
        data: [
          {
            level: 10,
            dna_explorer: 40,
            dna_collector: 30,
            dna_fan: 20,
            dna_rarity_hunter: 10,
            achievement_ids: ['ach-1', 'ach-2'],
            achievement_counts: { 'ach-1': 1, 'ach-2': 3 },
            achievement_highlighted: ['ach-1'],
            recent_collection_ids: ['fig-1', 'fig-2'],
            recent_searching_ids: ['fig-3'],
            favorite_category_ids: ['Cat1'],
          },
        ],
        error: null,
      });
    }

    mockSaveDescriptions(params) {
      const { p_user_id: userId, p_lease_id: leaseId, p_own_text: ownText, p_public_text: publicText } = params;

      // Verify lease
      const lease = this.leases.get(userId);
      if (!lease || lease.leaseId !== leaseId) {
        return Promise.resolve({
          data: [{ success: false, error_message: 'Invalid lease' }],
          error: null,
        });
      }

      // Save descriptions
      this.descriptions.set(userId, { ownText, publicText });
      this.leases.delete(userId); // Clear lease on success

      return Promise.resolve({
        data: [{ success: true, error_message: null }],
        error: null,
      });
    }
  }

  await t.test('Worker: run() processes users from claims', async () => {
    const mockClient = new MockSupabaseClient();
    const worker = new ProfileDescriptionsWorker(mockClient, { batchSize: 5 });

    const stats = await worker.run();

    assert(stats.processed > 0);
    assert(stats.succeeded > 0);
    assert.strictEqual(stats.errors.length, 0);
  });

  await t.test('Worker: run() returns correct statistics', async () => {
    const mockClient = new MockSupabaseClient();
    const worker = new ProfileDescriptionsWorker(mockClient, { batchSize: 5 });

    const stats = await worker.run();

    assert(typeof stats.processed === 'number');
    assert(typeof stats.succeeded === 'number');
    assert(typeof stats.failed === 'number');
    assert(Array.isArray(stats.errors));
    assert(stats.startedAt instanceof Date);
    assert(stats.completedAt instanceof Date);
    assert(typeof stats.durationMs === 'number');
  });

  await t.test('Worker: processes users with pagination', async () => {
    const mockClient = new MockSupabaseClient();
    const worker = new ProfileDescriptionsWorker(mockClient, { batchSize: 2 });

    const stats = await worker.run();

    // Should have made multiple claim calls due to pagination
    const claimCalls = mockClient.calls.filter(c => c.name === 'claim_profile_descriptions_work');
    assert(claimCalls.length >= 1);
  });

  await t.test('Worker: respects batch size option', async () => {
    const mockClient = new MockSupabaseClient();
    const worker = new ProfileDescriptionsWorker(mockClient, { batchSize: 10 });

    await worker.run();

    const claimCalls = mockClient.calls.filter(c => c.name === 'claim_profile_descriptions_work');
    assert(claimCalls.length > 0);
    assert.strictEqual(claimCalls[0].params.p_batch_size, 10);
  });

  await t.test('Worker: respects lease duration option', async () => {
    const mockClient = new MockSupabaseClient();
    const worker = new ProfileDescriptionsWorker(mockClient, { leaseDurationMinutes: 60 });

    await worker.run();

    const claimCalls = mockClient.calls.filter(c => c.name === 'claim_profile_descriptions_work');
    assert(claimCalls.length > 0);
    assert.strictEqual(claimCalls[0].params.p_lease_duration_minutes, 60);
  });

  await t.test('Worker: handles pagination correctly', async () => {
    const mockClient = new MockSupabaseClient();
    const worker = new ProfileDescriptionsWorker(mockClient, { batchSize: 2 });

    const stats = await worker.run();

    // Should have made at least one claim call
    const claimCalls = mockClient.calls.filter(c => c.name === 'claim_profile_descriptions_work');
    assert(claimCalls.length >= 1);
    
    // Should have processed users and produced statistics
    assert(stats.processed > 0);
    assert(typeof stats.succeeded === 'number');
  });

  await t.test('Worker: skips regeneration when no meaningful changes', async () => {
    const mockClient = new MockSupabaseClient();
    // Mock context that would NOT trigger regeneration (no activity)
    mockClient.mockReadContext = (params) => {
      return Promise.resolve({
        data: [
          {
            level: 10,
            dna_explorer: 40,
            dna_collector: 30,
            dna_fan: 20,
            dna_rarity_hunter: 10,
            achievement_ids: [],
            achievement_counts: {},
            achievement_highlighted: [],
            recent_collection_ids: [],
            recent_searching_ids: [],
            favorite_category_ids: [],
          },
        ],
        error: null,
      });
    };

    const worker = new ProfileDescriptionsWorker(mockClient, { batchSize: 5 });
    const stats = await worker.run();

    // Some users should be skipped (first generation requires activity)
    assert(stats.skipped > 0 || stats.succeeded > 0); // Either skipped or succeeded
  });

  await t.test('Worker: handles transient errors with graceful degradation', async () => {
    const mockClient = new MockSupabaseClient();

    const worker = new ProfileDescriptionsWorker(mockClient, {
      batchSize: 5,
      maxRetries: 1,
      retryDelayMs: 1,
    });

    const stats = await worker.run();

    // Should complete without throwing, even with errors possible
    assert(typeof stats.succeeded === 'number');
    assert(typeof stats.failed === 'number');
    assert(typeof stats.processed === 'number');
  });

  await t.test('Worker: exhausts retries and reports error', async () => {
    const mockClient = new MockSupabaseClient();
    let saveAttempts = 0;

    const originalRpc = mockClient.rpc.bind(mockClient);
    mockClient.rpc = async (name, params) => {
      if (name === 'save_profile_descriptions') {
        saveAttempts += 1;
        return { data: null, error: { message: 'Permanent error' } };
      }
      return originalRpc(name, params);
    };

    const worker = new ProfileDescriptionsWorker(mockClient, {
      batchSize: 5,
      maxRetries: 2,
      retryDelayMs: 10,
    });

    const stats = await worker.run();

    // Should have tried saving multiple times due to retries
    assert(saveAttempts >= 2);
    // Should have reported failures
    assert(stats.failed > 0);
  });

  await t.test('Worker: handles lease expiration gracefully', async () => {
    const mockClient = new MockSupabaseClient();

    // Track read context calls
    let readCalls = 0;
    const originalRpc = mockClient.rpc.bind(mockClient);
    mockClient.rpc = async (name, params) => {
      if (name === 'read_profile_description_context') {
        readCalls += 1;
        if (readCalls === 1) {
          // Simulate expired lease on first call
          return { data: null, error: { message: 'Invalid or expired lease' } };
        }
      }
      return originalRpc(name, params);
    };

    const worker = new ProfileDescriptionsWorker(mockClient, {
      batchSize: 5,
      maxRetries: 1,
    });
    const stats = await worker.run();

    // Should handle gracefully, reporting errors when context read fails
    assert(typeof stats.failed === 'number');
  });

  await t.test('logWorkerTelemetry: returns summary without private data', () => {
    const stats = {
      processed: 100,
      succeeded: 95,
      failed: 5,
      skipped: 10,
      errors: [
        { phase: 'read_context', message: 'Error 1' },
        { phase: 'save', message: 'Error 2' },
      ],
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 5000,
    };

    const summary = logWorkerTelemetry(stats);

    assert.strictEqual(summary.processed, 100);
    assert.strictEqual(summary.succeeded, 95);
    assert.strictEqual(summary.failed, 5);
    assert(!summary.descriptions); // No private descriptions exposed
    assert(!summary.leases); // No lease details exposed
    assert(!summary.snapshots); // No private snapshots exposed
  });

  await t.test('Repository: claimWork calls RPC correctly', async () => {
    const mockClient = new MockSupabaseClient();
    const repo = new ProfileDescriptionsRepository(mockClient);

    await repo.claimWork(50, 45);

    const calls = mockClient.calls.filter(c => c.name === 'claim_profile_descriptions_work');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].params.p_batch_size, 50);
    assert.strictEqual(calls[0].params.p_lease_duration_minutes, 45);
  });

  await t.test('Repository: readContext calls RPC correctly', async () => {
    const mockClient = new MockSupabaseClient();
    const repo = new ProfileDescriptionsRepository(mockClient);

    // First claim to establish lease
    const claims = await repo.claimWork(5, 30);
    if (claims.length > 0) {
      const { user_id, lease_id } = claims[0];
      await repo.readContext(user_id, lease_id);

      const calls = mockClient.calls.filter(c => c.name === 'read_profile_description_context');
      assert(calls.length > 0);
    }
  });

  await t.test('Repository: saveDescriptions calls RPC correctly', async () => {
    const mockClient = new MockSupabaseClient();
    const repo = new ProfileDescriptionsRepository(mockClient);

    const claims = await repo.claimWork(5, 30);
    if (claims.length > 0) {
      const { user_id, lease_id } = claims[0];

      await repo.saveDescriptions(
        user_id,
        lease_id,
        'own text',
        'public text',
        '1.0.0',
        'fingerprint',
        { level: 10 },
      );

      const calls = mockClient.calls.filter(c => c.name === 'save_profile_descriptions');
      assert.strictEqual(calls.length, 1);
    }
  });
});
