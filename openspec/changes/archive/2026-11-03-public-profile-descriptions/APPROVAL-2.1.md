# Task 2.1: Owner Approval for Profile Descriptions Worker RPC Allowlist

## Status
⏸️ **BLOCKED** - Awaiting explicit owner approval before proceeding to implementation.

## Summary
The profile descriptions worker requires three new, allowlisted RPCs to operate securely:

1. **claim_profile_descriptions_work** - Claim next batch of users with lease protection
2. **read_profile_description_context** - Read minimal context without exposing private data
3. **save_profile_descriptions** - Atomically save both variants with snapshot and lease release

## Why Approval Required
This represents a **new global exception** to the JWT/RLS-only authorization policy:

- Worker will use `service_role` internally (through RPCs only)
- Service_role gets **no direct table access** — only through these 3 allowlisted functions
- Functions verify lease ownership, user isolation, and atomic persistence
- This is a permanent, privileged feature that handles user data at scale

## Approval Checklist

Before implementation and deployment, the owner must:

- [ ] Review `rpc-allowlist.sql` in this directory
- [ ] Confirm the three RPC function signatures meet requirements
- [ ] Verify the security boundaries (no direct table access, role checks, lease isolation)
- [ ] Confirm the scope (profile descriptions only, no expansion to other features)
- [ ] Approve the exception and sign off with:
  - Owner name/signature
  - Date
  - Approval ID or ticket number

## Document Location
See `rpc-allowlist.sql` for the complete RPC specification with security guarantees.

## Next Steps
Once approved:
1. RPC functions will be created in Supabase
2. PGlite tests will verify grants, identity isolation, and lease behavior
3. Worker implementation will follow in tasks 3.1-3.3

---
**Prepared for:** Project Owner Review
**Prepared by:** Copilot
**Prepared at:** 2026-11-02
