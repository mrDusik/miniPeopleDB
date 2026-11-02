# Design

## Context

See `proposal.md` for motivation and the spec deltas for observable behavior. The own DNA route currently returns the authenticated user's aggregate DNA; `amigos_perfil` returns a limited read-only projection of another user's profile. Favorite categories are stored privately in `user_profile_favorite_categories`. The existing daily analytics worker is durable, externally triggered, and restricted to allowlisted RPCs; it is not a Sunday scheduler for this feature. Android packages a copy of the static `public/` assets under `dist/android`.

The generated text is public profile content even though some source signals, especially favorite categories, are private. The owner has authorized using those preferences as context and allowing the resulting prose to reflect them, while keeping their raw list private.

## Goals / Non-Goals

**Goals:**
- Generate two deterministic, versioned variants from one coherent per-user context: second person for the owner and neutral third person for viewers.
- Run a recoverable Sunday batch only when meaningful context changes have accumulated since the last successful generation.
- Keep private source snapshots and job state behind narrow database functions; expose only the relevant description through existing authenticated profile projections.
- Define web and Android display/verification separately so Android work can continue on another machine.

**Non-Goals:**
- Call a hosted or local generative model, add an AI provider dependency, or send collection data to a third party.
- Publish the raw favorite-category list, full achievement state, DNA weights, source fingerprint, or generation snapshot.
- Change how DNA, achievements, favorites, or the user's collection are calculated or edited.
- Package an APK as part of this proposal or claim Android verification without building and installing it.

## Decisions

### Deterministic prose with paired voices

Implement a pure template composer that accepts a validated summary and returns `{ own, public }`. It selects short fragments from the strongest DNA signals, level band, earned-achievement IDs and quantities, highlighted IDs, favorite categories, and category/era distribution in the recent lists. The public profile text SHALL use third-person neutral constructions that avoid gendered nouns; the own version SHALL address the user in second person. Template language SHALL echo the app's playful achievement/DNA tone, but SHALL NOT name exact achievements, category names, figure names, or percentages in the final prose. It SHALL not infer personality, motives, gender, or ownership facts beyond the summary. Keep an explicit template version and a conservative output-length ceiling (240 characters) so the description remains a compact profile summary.

This favors predictable, testable output and zero inference cost over a generative model. Unit tests can cover every fragment-selection rule and prove both voices use the same facts without unsupported claims.

### Private generated row and accumulated activity baseline

Store one row per account in a private `user_profile_descriptions` table with both text variants, `generated_at`, `template_version`, a fingerprint, and a compact private source snapshot. The snapshot contains only fields needed to compare activity: level, four DNA percentages, achievement IDs/counts, highlighted IDs, the IDs/states in each current latest-five list, and favorite category names. RLS and grants SHALL prevent direct cross-account reads; account deletion cascades the row. Public projections return neither snapshot nor fingerprint.

Compare each Sunday against the last successfully generated snapshot, not merely the previous scan. This lets small DNA movements and repeated achievement increments accumulate instead of being discarded by a no-op weekly run. Qualifying events and the initial-generation gate are defined by the new capability spec. A skipped run leaves the previous baseline untouched; a successful run atomically advances both variants and the baseline. Changing only display metadata that does not affect the selected narrative signals does not trigger generation.

### Sunday worker, external trigger, and privilege boundary

Use a dedicated `POST /api/cron/profile-descriptions` trigger protected by the existing cron secret mechanism and called once each Sunday by an external scheduler (UTC, configurable schedule; default 03:00 UTC). Do not use a process-local interval: multiple backend instances must not independently generate the batch. Persist a run, per-user progress, claim/lease, and completion state. Page users deterministically, retry transient storage errors, recover expired leases, and make a repeated trigger for a completed Sunday idempotent. One user's failure must not discard successful descriptions for other users.

The backend worker obtains only the required per-user summary and persists results through new, individually allowlisted RPCs. These functions must verify `service_role`, run/lease ownership, eligible user membership, payload shape, and expected source revision; there are no direct service-role table grants and no route parameter that lets a caller select an arbitrary profile. Ordinary owner reads continue through JWT/RLS or the existing authenticated DNA/profile projection. This is a proposed new global exception, not authorization to implement it: the project owner must explicitly approve the exact RPC allowlist, and PGlite must verify grants, identity isolation, lease scope, atomic persistence, and cascades before implementation/deployment.

### Reuse existing profile projections; keep clients thin

Extend the authenticated own-DNA response with the own variant and extend `amigos_perfil` with only the public variant (or explicit `null`). Do not return favorite categories or source snapshots in either response. Render the own text in the DNA modal below the chart and before the legend; render the public text in the existing profile overview before the figure groups. The public profile remains available to authenticated viewers without requiring friendship, matching its current contract.

If no description exists, omit the text without replacing other DNA/profile content. A read does not generate or mutate a description. Existing clients can ignore an additive response property; Android needs a newly packaged web bundle to display the new section.

### Separate Android validation

Keep Android tasks as a distinct final group in `tasks.md`, intentionally incomplete until a developer with the Android SDK and device on the other computer builds, installs, and checks both modals. The source change is shared `public/` UI; the local Android generation copies those resources into `dist/android`, then Capacitor sync and Gradle create the APK. Do not commit generated build output unless the repository's existing conventions require it. Web tests do not count as Android verification.

## Risks / Trade-offs

- [The public prose can reveal interests derived from private favorites] → This is explicitly authorized for the description feature; never return the raw favorite list, and document the derived disclosure in both profile and Amigos contracts.
- [A global weekly worker expands the privileged-access surface] → Require explicit owner approval of the exact allowlisted RPCs before implementation; test role denial, user scope, lease, and atomic writes with PGlite; grant no direct service-role table access.
- [A template can sound repetitive or overstate weak evidence] → Use a small composable phrase catalog, omit unsupported fragments, impose a length limit, and test low-data and mixed-signal cases.
- [Source changes while a user is being processed] → Read a revision with the context and conditionally persist against that revision; retry a bounded number of times, then leave the previous text intact.
- [One description variant updates while the other fails] → Persist both variants, baseline, fingerprint, and timestamp in one transaction.
- [Users on an old Android APK will not see the new section] → Keep the API additive and record Android build/install verification as a separate task for the other machine.
- [Favorite-only profiles may not meet the first-generation activity gate] → Keep the DNA/profile sections functional and omit the description until an achievement or recent figure provides enough collection activity.

## Migration Plan

1. Obtain and record explicit approval for the new narrow profile-description RPC allowlist. Do not use the proposed worker exception before that gate is satisfied.
2. Deploy additive SQL for private description/job state and the approved RPCs, with RLS/grants and PGlite security tests. Do not expose source snapshots through public policies.
3. Deploy backend template/API/worker code with the Sunday trigger disabled until SQL permissions and the external scheduler secret are verified. Enable the scheduler after review.
4. Allow the first Sunday run to create descriptions only for accounts meeting the initial activity gate; process in bounded pages and keep existing users' profiles valid when no text is generated.
5. Deploy the web UI independently. On the other computer, build/sync/install the Android APK and complete the separated Android checks before marking that task group done.
6. Roll back by disabling the external schedule first, then the trigger/worker and UI. Keep old API fields and existing profile data intact; the additive description row can remain unused until a separately approved cleanup. Never remove favorites or collection data as rollback.

## Open Questions

None. The scheduler time has a UTC default, the activity gate is specified, and the privileged RPC approval is an explicit pre-implementation gate rather than an unresolved design choice.