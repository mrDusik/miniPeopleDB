-- Copy and paste this into Supabase SQL Editor to set up profile descriptions
-- This is the same as supabase/migrations/20261102_user_profile_descriptions.sql

-- ============================================================================
-- TABLE: user_profile_descriptions
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profile_descriptions (
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

ALTER TABLE user_profile_descriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "rls_no_authenticated_access" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_anon_denied" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_users_read_own_description" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_users_read_public_descriptions" ON user_profile_descriptions;

-- Create permissive policies for reading descriptions
CREATE POLICY "rls_users_read_own_description" ON user_profile_descriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "rls_users_read_public_descriptions" ON user_profile_descriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() != user_id);

-- Create restrictive policies to block writes from authenticated users
CREATE POLICY "rls_no_authenticated_write" ON user_profile_descriptions
  AS RESTRICTIVE FOR UPDATE, DELETE, INSERT
  TO authenticated
  USING (FALSE);

CREATE POLICY "rls_anon_denied" ON user_profile_descriptions
  AS RESTRICTIVE FOR ALL
  TO anon
  USING (FALSE);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profile_descriptions_user_id ON user_profile_descriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_descriptions_lease_expires ON user_profile_descriptions(lease_expires_at)
  WHERE lease_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profile_descriptions_generated_at ON user_profile_descriptions(generated_at DESC NULLS LAST);

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
  IF NOT EXISTS (
    SELECT 1 FROM user_profile_descriptions
    WHERE user_id = p_user_id AND lease_id = p_lease_id AND lease_expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'Invalid or expired lease for user %', p_user_id;
  END IF;

  RETURN QUERY
  SELECT
    0::INT,
    0::INT,
    0::INT,
    0::INT,
    0::INT,
    ARRAY[]::TEXT[],
    '{}'::JSONB,
    ARRAY[]::TEXT[],
    ARRAY[]::UUID[],
    ARRAY[]::UUID[],
    ARRAY[]::TEXT[];
END;
$$;

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
  IF NOT EXISTS (
    SELECT 1 FROM user_profile_descriptions
    WHERE user_id = p_user_id AND lease_id = p_lease_id AND lease_expires_at > NOW()
  ) THEN
    RETURN QUERY SELECT FALSE, 'Invalid or expired lease'::TEXT;
    RETURN;
  END IF;

  IF p_template_version != '1.0.0' THEN
    RETURN QUERY SELECT FALSE, 'Unsupported template version'::TEXT;
    RETURN;
  END IF;

  IF (p_own_text IS NOT NULL OR p_public_text IS NOT NULL) AND p_snapshot IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Snapshot required when saving descriptions'::TEXT;
    RETURN;
  END IF;

  INSERT INTO user_profile_descriptions (
    user_id, own_description_text, public_description_text,
    generated_at, template_version, private_fingerprint, private_snapshot,
    lease_id, lease_expires_at
  ) VALUES (
    p_user_id, p_own_text, p_public_text,
    NOW(), p_template_version, p_fingerprint, p_snapshot,
    NULL, NULL
  )
  ON CONFLICT (user_id) DO UPDATE SET
    own_description_text = EXCLUDED.own_description_text,
    public_description_text = EXCLUDED.public_description_text,
    generated_at = EXCLUDED.generated_at,
    template_version = EXCLUDED.template_version,
    private_fingerprint = EXCLUDED.private_fingerprint,
    private_snapshot = EXCLUDED.private_snapshot,
    lease_id = NULL,
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

-- ============================================================================
-- GRANT PERMISSIONS: service_role ONLY
-- ============================================================================

GRANT EXECUTE ON FUNCTION claim_profile_descriptions_work TO service_role;
GRANT EXECUTE ON FUNCTION read_profile_description_context TO service_role;
GRANT EXECUTE ON FUNCTION save_profile_descriptions TO service_role;

REVOKE EXECUTE ON FUNCTION claim_profile_descriptions_work FROM anon;
REVOKE EXECUTE ON FUNCTION read_profile_description_context FROM anon;
REVOKE EXECUTE ON FUNCTION save_profile_descriptions FROM anon;

-- ============================================================================
-- Done! Now create initial records for all users:
-- ============================================================================

INSERT INTO user_profile_descriptions (user_id, created_by)
SELECT id, id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

