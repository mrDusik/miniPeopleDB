/**
 * Read-only repository for profile descriptions
 * Exposes user's own description and public descriptions of other users
 */

export class ProfileDescriptionReadError extends Error {
  constructor(code = 'DESCRIPCION_NO_DISPONIBLE') {
    super(code);
    this.code = code;
    this.status = 500;
  }
}

export class ProfileDescriptionsReadRepository {
  constructor({ client, userId }) {
    this.client = client;
    this.userId = userId;
  }

  /**
   * Read the authenticated user's own profile description.
   * Returns null if no description has been generated yet.
   * Never exposes snapshot or fingerprint.
   */
  async readOwnDescription() {
    try {
      const { data, error } = await this.client
        .from('user_profile_descriptions')
        .select('own_description_text')
        .eq('user_id', this.userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - description not generated yet
          return null;
        }
        throw error;
      }

      return data?.own_description_text || null;
    } catch (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found is not an error
      }
      throw new ProfileDescriptionReadError();
    }
  }

  /**
   * Read a public profile description for another user.
   * Returns null if no description has been generated yet or user doesn't exist.
   * Never exposes snapshot or fingerprint.
   */
  async readPublicDescription(userId) {
    try {
      const { data, error } = await this.client
        .from('user_profile_descriptions')
        .select('public_description_text')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - description not generated yet
          return null;
        }
        throw error;
      }

      return data?.public_description_text || null;
    } catch (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found is not an error
      }
      throw new ProfileDescriptionReadError();
    }
  }
}
