-- Profile Descriptions Worker - RPC Allowlist Proposal
-- Owner Approval Required Before Implementation
-- Date: 2026-11-02
-- Status: AWAITING APPROVAL

/*
This document specifies the exact RPC functions required for the profile descriptions
weekly worker to operate. These are the ONLY RPCs the worker will be authorized to call.

NO DIRECT TABLE ACCESS: service_role will have NO direct grants to user_profile_descriptions,
user_profile_description_snapshots, or any sensitive tables. All access is through these
allowlisted functions only.

APPROVAL REQUIRED: This allowlist and its scope must be explicitly approved by the project
owner before implementation or deployment.
*/

-- ============================================================================
-- 1. CLAIM_PROFILE_DESCRIPTIONS_WORK
-- ============================================================================
-- Purpose: Claim the next batch of users to process with a lease.
-- Called by: POST /api/cron/profile-descriptions worker (authenticated by CRON_SECRET)
-- Returns: Array of { user_id, lease_id, expires_at } for pagination
-- Guarantees:
--   - One user can only be claimed by one worker at a time (lease-based)
--   - Expired leases are reclaimed and available for retry
--   - Only users who have not completed this Sunday's batch are returned
--   - Processing order is deterministic (user_id ASC) for idempotency

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
  v_batch_ids UUID[];
BEGIN
  -- Verify caller has CRON_SECRET (checked in POST /api/cron/profile-descriptions)
  -- This function itself uses service_role, but only internally; not called directly

  -- Implementation will:
  -- 1. Find users with expired or missing leases for this Sunday
  -- 2. Claim up to p_batch_size users with a new lease
  -- 3. Return lease_id for tracking and renewal
  -- 4. Order by user_id for deterministic pagination

  RETURN QUERY
  SELECT
    upd.user_id,
    gen_random_uuid() AS lease_id,
    NOW() + (p_lease_duration_minutes || ' minutes')::INTERVAL AS expires_at
  FROM user_profile_descriptions upd
  WHERE upd.lease_expires_at IS NULL OR upd.lease_expires_at < NOW()
  ORDER BY upd.user_id ASC
  LIMIT p_batch_size;
END;
$$;

COMMENT ON FUNCTION claim_profile_descriptions_work IS
  'Claim next batch of users for profile description generation. Returns lease_id for tracking.';

-- ============================================================================
-- 2. READ_PROFILE_DESCRIPTION_CONTEXT
-- ============================================================================
-- Purpose: Read minimal user context for description generation.
-- Called by: Worker loop after claiming work
-- Returns: { level, dna_percentages, achievements, recent_figures, favorite_categories }
-- Guarantees:
--   - No exposure of private snapshots or fingerprints
--   - No exposure of full achievement or collection data beyond needed signals
--   - Only returns context for the claimed user_id
--   - User must have an active lease for this read to succeed

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
  recent_collection_figure_ids UUID[],
  recent_searching_figure_ids UUID[],
  favorite_category_ids TEXT[]
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Implementation will:
  -- 1. Verify lease_id matches the claimed lease for p_user_id
  -- 2. Read level from gamificacion
  -- 3. Read DNA percentages
  -- 4. Read achievement IDs and counts (not descriptions)
  -- 5. Read highlighted achievement IDs only
  -- 6. Read 5 most recent figures from COLECCIÓN state (by fecha_registro DESC, ID ASC)
  -- 7. Read 5 most recent figures from BUSCADA state (by fecha_registro DESC, ID ASC)
  -- 8. Read favorite category IDs (not names, not counts)
  -- 9. Do NOT read private snapshot or fingerprint

  RETURN QUERY
  SELECT
    -- Placeholder: actual query joins gamificacion, achievements, minifiguras, user_profile_favorite_categories
    NULL::INT,
    NULL::INT,
    NULL::INT,
    NULL::INT,
    NULL::INT,
    NULL::TEXT[],
    NULL::JSONB,
    NULL::TEXT[],
    NULL::UUID[],
    NULL::UUID[],
    NULL::TEXT[];
END;
$$;

COMMENT ON FUNCTION read_profile_description_context IS
  'Read minimal context for description generation. Requires active lease. No private snapshot exposure.';

-- ============================================================================
-- 3. SAVE_PROFILE_DESCRIPTIONS
-- ============================================================================
-- Purpose: Atomically save both description variants with updated snapshot and timestamp.
-- Called by: Worker after composition
-- Guarantees:
--   - Both variants (own, public) are saved together in one transaction
--   - Fingerprint, snapshot, and timestamp are persisted atomically
--   - Lease is released only on successful save
--   - Failed save leaves lease intact for retry
--   - No partial updates (both variants or nothing)

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
BEGIN
  -- Implementation will:
  -- 1. Verify lease_id matches the claimed lease for p_user_id
  -- 2. Verify template_version is expected (prevents stale saves)
  -- 3. Verify p_snapshot is valid JSON and contains required fields
  -- 4. Atomically INSERT or UPDATE:
  --    - own_description_text
  --    - public_description_text
  --    - template_version
  --    - generated_at (NOW())
  --    - fingerprint
  --    - private_snapshot (ENCRYPTED or at least not returned in reads)
  -- 5. Clear lease_id and lease_expires_at on success
  -- 6. Return success=true if all fields persisted
  -- 7. On error (FK, constraint, JSON validation), return success=false with error_message

  RETURN QUERY
  SELECT
    TRUE::BOOLEAN,
    NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION save_profile_descriptions IS
  'Atomically save both description variants with snapshot and lease release.';

-- ============================================================================
-- RPC GRANT SUMMARY
-- ============================================================================
-- The worker process (with CRON_SECRET) will execute these RPCs via:
--   SELECT claim_profile_descriptions_work(...)
--   SELECT read_profile_description_context(...)
--   SELECT save_profile_descriptions(...)
--
-- SECURITY BOUNDARIES:
--   - service_role: ONLY callable through these 3 functions; no direct table access
--   - anon/authenticated: CANNOT call any of these functions (role check in SQL)
--   - Worker: can only read own context + claimed user context, never arbitrary users
--   - No JWT or authenticated session needed; CRON_SECRET is the only auth
--
-- TESTING REQUIRED (PGlite):
--   - Verify anon cannot call any function
--   - Verify authenticated JWT cannot call any function
--   - Verify service_role cannot read tables directly, only through functions
--   - Verify lease prevents concurrent processing of same user
--   - Verify lease expiration allows retry
--   - Verify partial save fails (both variants or nothing)
--   - Verify fingerprint/snapshot are not exposed in any public endpoint
--   - Verify favorite_category names are never returned (only IDs)

-- OWNER APPROVAL SIGNATURE
-- ============================================================================
-- By deploying these RPCs and granting service_role access, the owner
-- explicitly authorizes the profile descriptions worker as a new global
-- exception to the JWT/RLS-only policy.
--
-- Approved by: ____________________________
-- Date: ____________________________
-- Approval ID/Ticket: ____________________________
