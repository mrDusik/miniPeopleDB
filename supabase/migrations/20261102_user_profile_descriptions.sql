-- Migration: Create user_profile_descriptions table and RPC allowlist
-- Timestamp: 2026-11-02
-- Status: Requires explicit owner approval via APPROVAL-2.1.md

-- ============================================================================
-- TABLE: user_profile_descriptions
-- ============================================================================
-- Private table for storing generated description variants.
-- RLS: row-level security via created_by, enabled to prevent direct access.
-- Cascades: deleted when user auth.users account is deleted.

CREATE TABLE user_profile_descriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Description variants (public should be part of amigos_perfil response)
  own_description_text TEXT,
  public_description_text TEXT,
  
  -- Tracking
  generated_at TIMESTAMPTZ,
  template_version TEXT NOT NULL DEFAULT '1.0.0',
  
  -- Private snapshot and fingerprint (never exposed in API)
  private_fingerprint TEXT,
  private_snapshot JSONB,
  
  -- Lease tracking for worker coordination
  lease_id UUID UNIQUE,
  lease_expires_at TIMESTAMPTZ,
  
  CONSTRAINT own_text_length CHECK (own_description_text IS NULL OR LENGTH(own_description_text) <= 240),
  CONSTRAINT public_text_length CHECK (public_description_text IS NULL OR LENGTH(public_description_text) <= 240),
  CONSTRAINT snapshot_not_null_when_generated CHECK (
    (generated_at IS NULL) OR (private_snapshot IS NOT NULL AND private_fingerprint IS NOT NULL)
  )
);

-- RLS: Enable security; users cannot read directly
ALTER TABLE user_profile_descriptions ENABLE ROW LEVEL SECURITY;

-- Policy: service_role can access through allowlisted functions only
-- Ordinary authenticated users cannot query this table
CREATE POLICY "rls_no_authenticated_access" ON user_profile_descriptions
  AS RESTRICTIVE FOR ALL
  TO authenticated
  USING (FALSE);

CREATE POLICY "rls_anon_denied" ON user_profile_descriptions
  AS RESTRICTIVE FOR ALL
  TO anon
  USING (FALSE);

-- Indexes for worker and cascade queries
CREATE INDEX idx_user_profile_descriptions_user_id ON user_profile_descriptions(user_id);
CREATE INDEX idx_user_profile_descriptions_lease_expires ON user_profile_descriptions(lease_expires_at)
  WHERE lease_expires_at IS NOT NULL;
CREATE INDEX idx_user_profile_descriptions_generated_at ON user_profile_descriptions(generated_at DESC NULLS LAST);

COMMENT ON TABLE user_profile_descriptions IS 'Private table: generated profile description variants for each user. Never expose snapshot, fingerprint, or lease data in public APIs.';
COMMENT ON COLUMN user_profile_descriptions.own_description_text IS 'Second person description (user sees "You are..."). Max 240 chars.';
COMMENT ON COLUMN user_profile_descriptions.public_description_text IS 'Third person description (visible in Amigos profile). Max 240 chars. Can be NULL if no description generated yet.';
COMMENT ON COLUMN user_profile_descriptions.private_snapshot IS 'PRIVATE: Cached context snapshot for detecting changes. Includes level, DNA, achievements, recent figures, favorites—never exposed.';
COMMENT ON COLUMN user_profile_descriptions.private_fingerprint IS 'PRIVATE: Hash of snapshot for comparison. Used to decide regeneration. Never exposed.';
COMMENT ON COLUMN user_profile_descriptions.lease_id IS 'PRIVATE: Active worker lease ID. Worker must hold matching lease to read context or save result.';

-- ============================================================================
-- RPC 1: claim_profile_descriptions_work
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_profile_descriptions_work(
  p_batch_size INT DEFAULT 100,
  p_lease_duration_minutes INT DEFAULT 30
)
RETURNS TABLE (
  user_id UUID,
  lease_id UUID,
  expires_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lease_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_lease_id := gen_random_uuid();
  v_expires_at := NOW() + (p_lease_duration_minutes || ' minutes')::INTERVAL;

  -- Claim up to p_batch_size users with expired or no lease for this Sunday.
  -- Order by user_id for deterministic pagination.
  RETURN QUERY
  WITH users_to_claim AS (
    SELECT upd.id, upd.user_id
    FROM user_profile_descriptions upd
    WHERE (upd.lease_expires_at IS NULL OR upd.lease_expires_at < NOW())
    ORDER BY upd.user_id ASC
    LIMIT p_batch_size
    FOR UPDATE
  )
  UPDATE user_profile_descriptions
  SET lease_id = v_lease_id, lease_expires_at = v_expires_at
  FROM users_to_claim
  WHERE user_profile_descriptions.id = users_to_claim.id
  RETURNING user_profile_descriptions.user_id, v_lease_id, v_expires_at;
END;
$$;

COMMENT ON FUNCTION claim_profile_descriptions_work IS
  'Claim next batch of users for profile description generation. Requires service_role. Returns lease_id for tracking.';

-- ============================================================================
-- RPC 2: read_profile_description_context
-- ============================================================================

CREATE OR REPLACE FUNCTION read_profile_description_context(
  p_user_id UUID,
  p_lease_id UUID
)
RETURNS TABLE (
  level INT,
  dna_explorer INT,
  dna_collector INT,
  dna_fan INT,
  dna_rarity_hunter INT,
  achievement_ids TEXT[],
  achievement_counts JSONB,
  achievement_highlighted TEXT[],
  recent_collection_ids UUID[],
  recent_searching_ids UUID[],
  favorite_category_ids TEXT[]
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Verify lease ownership
  IF NOT EXISTS (
    SELECT 1 FROM user_profile_descriptions
    WHERE user_id = p_user_id AND lease_id = p_lease_id AND lease_expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'Invalid or expired lease for user %', p_user_id;
  END IF;

  -- Return minimal context without exposing private data.
  -- This is a placeholder; actual implementation joins gamificacion, achievements, etc.
  RETURN QUERY
  SELECT
    0::INT,                    -- level (from gamificacion)
    0::INT,                    -- dna_explorer
    0::INT,                    -- dna_collector
    0::INT,                    -- dna_fan
    0::INT,                    -- dna_rarity_hunter
    ARRAY[]::TEXT[],           -- achievement_ids
    '{}'::JSONB,               -- achievement_counts
    ARRAY[]::TEXT[],           -- achievement_highlighted
    ARRAY[]::UUID[],           -- recent_collection_ids
    ARRAY[]::UUID[],           -- recent_searching_ids
    ARRAY[]::TEXT[];           -- favorite_category_ids
END;
$$;

COMMENT ON FUNCTION read_profile_description_context IS
  'Read minimal context for description generation. Requires active lease. Does not expose snapshot or fingerprint.';

-- ============================================================================
-- RPC 3: save_profile_descriptions
-- ============================================================================

CREATE OR REPLACE FUNCTION save_profile_descriptions(
  p_user_id UUID,
  p_lease_id UUID,
  p_own_text TEXT,
  p_public_text TEXT,
  p_template_version TEXT,
  p_fingerprint TEXT,
  p_snapshot JSONB
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rows_affected INT;
BEGIN
  -- Verify lease
  IF NOT EXISTS (
    SELECT 1 FROM user_profile_descriptions
    WHERE user_id = p_user_id AND lease_id = p_lease_id AND lease_expires_at > NOW()
  ) THEN
    RETURN QUERY SELECT FALSE, 'Invalid or expired lease'::TEXT;
    RETURN;
  END IF;

  -- Validate template version
  IF p_template_version != '1.0.0' THEN
    RETURN QUERY SELECT FALSE, 'Unsupported template version'::TEXT;
    RETURN;
  END IF;

  -- Validate snapshot is not null if either text is provided
  IF (p_own_text IS NOT NULL OR p_public_text IS NOT NULL) AND p_snapshot IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Snapshot required when saving descriptions'::TEXT;
    RETURN;
  END IF;

  -- Atomically update or insert both variants together.
  INSERT INTO user_profile_descriptions (
    user_id, own_description_text, public_description_text,
    generated_at, template_version, private_fingerprint, private_snapshot,
    lease_id, lease_expires_at
  ) VALUES (
    p_user_id, p_own_text, p_public_text,
    NOW(), p_template_version, p_fingerprint, p_snapshot,
    NULL, NULL  -- Clear lease on successful save
  )
  ON CONFLICT (user_id) DO UPDATE SET
    own_description_text = EXCLUDED.own_description_text,
    public_description_text = EXCLUDED.public_description_text,
    generated_at = EXCLUDED.generated_at,
    template_version = EXCLUDED.template_version,
    private_fingerprint = EXCLUDED.private_fingerprint,
    private_snapshot = EXCLUDED.private_snapshot,
    lease_id = NULL,  -- Release lease
    lease_expires_at = NULL
  WHERE user_profile_descriptions.lease_id = p_lease_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected > 0 THEN
    RETURN QUERY SELECT TRUE, NULL::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, 'No rows affected'::TEXT;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
END;
$$;

COMMENT ON FUNCTION save_profile_descriptions IS
  'Atomically save both description variants with snapshot. Clears lease on success. Requires active lease.';

-- ============================================================================
-- GRANT PERMISSIONS: service_role ONLY
-- ============================================================================
-- These functions are ONLY callable by service_role (via the backend with CRON_SECRET).
-- anon and authenticated cannot call them.

GRANT EXECUTE ON FUNCTION claim_profile_descriptions_work TO service_role;
GRANT EXECUTE ON FUNCTION read_profile_description_context TO service_role;
GRANT EXECUTE ON FUNCTION save_profile_descriptions TO service_role;

-- Deny execution for anon and authenticated
REVOKE EXECUTE ON FUNCTION claim_profile_descriptions_work FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION read_profile_description_context FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION save_profile_descriptions FROM anon, authenticated;

-- Explicitly deny direct table access for service_role (only through RPC)
REVOKE SELECT, INSERT, UPDATE, DELETE ON user_profile_descriptions FROM service_role;
