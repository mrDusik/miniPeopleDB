/**
 * Profile descriptions repository: manages persistence and queries for profile descriptions.
 */

export class ProfileDescriptionsRepository {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Claim next batch of users for processing.
   * @param {number} batchSize - how many users to claim
   * @param {number} leaseDurationMinutes - lease validity in minutes
   * @returns {Promise<Array>} - array of { user_id, lease_id, expires_at }
   */
  async claimWork(batchSize = 100, leaseDurationMinutes = 30) {
    const { data, error } = await this.supabase.rpc('claim_profile_descriptions_work', {
      p_batch_size: batchSize,
      p_lease_duration_minutes: leaseDurationMinutes,
    });

    if (error) {
      throw new Error(`Failed to claim work: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Read minimal context for a user (with active lease).
   * @param {string} userId - UUID of user
   * @param {string} leaseId - UUID of claimed lease
   * @returns {Promise<Object>} - context object
   */
  async readContext(userId, leaseId) {
    const { data, error } = await this.supabase.rpc('read_profile_description_context', {
      p_user_id: userId,
      p_lease_id: leaseId,
    });

    if (error) {
      throw new Error(`Failed to read context: ${error.message}`);
    }

    return data?.[0] || null;
  }

  /**
   * Save both description variants atomically.
   * @param {string} userId
   * @param {string} leaseId
   * @param {string} ownText
   * @param {string} publicText
   * @param {string} templateVersion
   * @param {string} fingerprint
   * @param {Object} snapshot
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async saveDescriptions(userId, leaseId, ownText, publicText, templateVersion, fingerprint, snapshot) {
    const { data, error } = await this.supabase.rpc('save_profile_descriptions', {
      p_user_id: userId,
      p_lease_id: leaseId,
      p_own_text: ownText,
      p_public_text: publicText,
      p_template_version: templateVersion,
      p_fingerprint: fingerprint,
      p_snapshot: snapshot,
    });

    if (error) {
      throw new Error(`Failed to save descriptions: ${error.message}`);
    }

    const result = data?.[0];
    if (!result?.success) {
      return { success: false, error: result?.error_message };
    }

    return { success: true };
  }
}
