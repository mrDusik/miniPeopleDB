# Task 3.3: External Scheduler Configuration for Profile Descriptions Worker

## Overview

The profile descriptions worker runs every Sunday at a configured UTC time. It is **not** triggered by the application server or any internal process—it requires an **external scheduler** (e.g., AWS EventBridge, Google Cloud Scheduler, cron job on a separate machine, etc.) to make a POST request to the backend trigger endpoint.

## Why External Scheduler?

- **Reliability**: No dependency on application uptime or internal state
- **Idempotency**: Multiple instances can safely receive the same trigger; lease-based claiming prevents duplicate processing
- **Simplicity**: Decoupled from application lifecycle; easier to monitor and debug
- **Scalability**: Scheduler is independent of application scaling

## Configuration

### Step 1: Set Environment Variables

Add to your deployment environment:

```bash
# .env or deployment configuration
CRON_SECRET=your-secure-random-secret-here
PROFILE_DESCRIPTIONS_SCHEDULE_TIME=03:00  # UTC hour:minute
PROFILE_DESCRIPTIONS_SCHEDULE_TIMEZONE=UTC
```

**Requirements:**
- `CRON_SECRET`: Must be a strong, random secret (min 32 characters)
- `PROFILE_DESCRIPTIONS_SCHEDULE_TIME`: UTC time in HH:MM format (default: 03:00 UTC)
- `PROFILE_DESCRIPTIONS_SCHEDULE_TIMEZONE`: Always UTC for consistency

### Step 2: Configure External Scheduler

Choose your scheduler platform and configure a recurring rule:

#### Option A: AWS EventBridge

```json
{
  "Name": "profile-descriptions-sunday",
  "Description": "Weekly profile descriptions generation",
  "ScheduleExpression": "cron(0 3 ? * SUN *)",
  "State": "ENABLED",
  "Targets": [
    {
      "Arn": "arn:aws:events:region:account:...",
      "RoleArn": "arn:aws:iam::account:role/EventBridgeRole",
      "HttpParameters": {
        "HeaderParameters": {
          "x-cron-secret": "value-of-CRON_SECRET",
          "content-type": "application/json"
        }
      },
      "HttpMethod": "POST",
      "Url": "https://your-backend.example.com/api/cron/profile-descriptions"
    }
  ]
}
```

#### Option B: Google Cloud Scheduler

```bash
gcloud scheduler jobs create http profile-descriptions-sunday \
  --schedule="0 3 * * 0" \
  --time-zone="UTC" \
  --uri="https://your-backend.example.com/api/cron/profile-descriptions" \
  --http-method="POST" \
  --headers="x-cron-secret=value-of-CRON_SECRET"
```

#### Option C: Linux cron job (on a separate machine with curl)

```bash
# /etc/cron.d/profile-descriptions
# Sunday at 03:00 UTC
0 3 * * 0 root curl -X POST https://your-backend.example.com/api/cron/profile-descriptions -H "x-cron-secret: value-of-CRON_SECRET" -H "content-type: application/json"
```

#### Option D: Heroku Scheduler

Heroku Scheduler does not support precise times. Use a Procfile worker + external trigger instead (not recommended for this use case).

### Step 3: Test Execution

**Manual Test (before scheduler is live):**

```bash
curl -X POST https://your-backend.example.com/api/cron/profile-descriptions \
  -H "x-cron-secret: your-CRON_SECRET-value" \
  -H "content-type: application/json"
```

**Expected Response:**

```json
{
  "success": true,
  "stats": {
    "duration_minutes": 5,
    "processed": 250,
    "succeeded": 245,
    "skipped": 5,
    "failed": 0,
    "error_count": 0,
    "started_at": "2026-11-03T03:00:00Z",
    "completed_at": "2026-11-03T03:05:00Z"
  }
}
```

**On Failure (missing secret):**

```json
{
  "success": false,
  "error": "Unauthorized: invalid or missing CRON_SECRET"
}
```

### Step 4: Verify Scheduler is Running

#### Check Logs

After the first scheduled execution:

```bash
# Look for telemetry logs
grep "Profile descriptions worker telemetry" your-application.log

# Expected output:
# Profile descriptions worker telemetry: {"duration_minutes":5,"processed":250,"succeeded":245,"skipped":5,"failed":0,"error_count":0,"started_at":"2026-11-03T03:00:00Z","completed_at":"2026-11-03T03:05:00Z"}
```

#### Query Database

Check that descriptions were generated:

```sql
SELECT 
  COUNT(*) as total_descriptions,
  COUNT(CASE WHEN generated_at > NOW() - INTERVAL '1 day' THEN 1 END) as updated_in_last_24h,
  MAX(generated_at) as latest_update
FROM user_profile_descriptions
WHERE public_description_text IS NOT NULL;
```

#### Monitor Scheduler Service

For AWS EventBridge:
```bash
aws events describe-rule --name profile-descriptions-sunday
aws events list-targets-by-rule --rule profile-descriptions-sunday
```

## Security Considerations

### CRON_SECRET Management

- **Never commit `CRON_SECRET` to version control**
- Use environment variables or secrets management:
  - AWS Secrets Manager
  - Google Secret Manager
  - HashiCorp Vault
  - Kubernetes Secrets
  - Deployment tool secrets (GitHub Actions, GitLab CI, etc.)

### Logging

- The worker logs summary statistics only, with **no private data** (descriptions, snapshots, fingerprints, lease IDs)
- Request headers containing the secret are **never logged**
- Error logs include only error phase and count, not user details

### Preventing Accidental Public Exposure

- API endpoint is POST only (no GET)
- Invalid CRON_SECRET returns `401 Unauthorized` without details
- Endpoint is not documented in public API docs (internal only)
- Rate limit can be applied at reverse proxy/WAF level

## Troubleshooting

### Scheduler is not triggering

1. Verify the scheduler rule is **ENABLED** (not suspended or paused)
2. Check scheduler logs in your platform (CloudWatch, Cloud Logging, etc.)
3. Verify the time zone setting—use **UTC** only
4. Check that the cron expression is correct for Sunday (day-of-week `0` or `SUN`)
5. Manual test with curl (see Step 3 above)

### Trigger succeeds but stats show `failed: 0, processed: 0`

- Check if all users already have descriptions generated
- Query the database to see if `generated_at` was recently updated
- Verify worker has access to Supabase RPC functions
- Check backend logs for errors

### Trigger returns 401 Unauthorized

- Verify `CRON_SECRET` environment variable is set
- Ensure header name is exactly `x-cron-secret` (lowercase)
- Check that the secret value matches exactly (no whitespace)
- Confirm the secret was deployed (not using stale image/config)

### Worker hangs or times out

- Check if users have active leases from a previous run
- Verify Supabase connection is stable
- Look for users with expired leases (> 30 minutes old); these can be reclaimed
- Increase `leaseDurationMinutes` if processing takes longer than expected

## Operational Runbook

### Starting the Job

The job starts automatically every Sunday at configured time. To start manually for testing:

```bash
curl -X POST https://your-backend.example.com/api/cron/profile-descriptions \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "content-type: application/json"
```

### Stopping the Job

To disable the scheduler temporarily (e.g., during maintenance):

**AWS EventBridge:**
```bash
aws events disable-rule --name profile-descriptions-sunday
```

**Google Cloud Scheduler:**
```bash
gcloud scheduler jobs pause profile-descriptions-sunday
```

**Cron:**
```bash
# Edit /etc/cron.d/profile-descriptions and comment out the line
```

### Restarting After Maintenance

**AWS EventBridge:**
```bash
aws events enable-rule --name profile-descriptions-sunday
```

**Google Cloud Scheduler:**
```bash
gcloud scheduler jobs resume profile-descriptions-sunday
```

## Rollback and Recovery

### If Descriptions Become Corrupted

1. **Stop the scheduler** (see above)
2. Query and identify affected users:
   ```sql
   SELECT user_id FROM user_profile_descriptions 
   WHERE generated_at > '2026-11-01T00:00:00Z' AND public_description_text LIKE '%corrupted%';
   ```
3. Delete corrupted rows (they will be regenerated):
   ```sql
   UPDATE user_profile_descriptions 
   SET own_description_text = NULL, public_description_text = NULL 
   WHERE user_id IN (...);
   ```
4. **Re-enable the scheduler**
5. Descriptions will regenerate on next Sunday run

### If Descriptions Never Generate

1. Verify `CRON_SECRET` and endpoint accessibility (manual test)
2. Check database RPC permissions:
   ```sql
   SELECT has_function_privilege('service_role', 'claim_profile_descriptions_work(INT, INT)', 'EXECUTE');
   ```
3. If permissions are broken, re-run the migration
4. Check user data for required context (level, achievements, DNA)

## Monitoring and Alerting

### Recommended Alerts

Set up alerts for:

1. **Scheduler failure**: Detect failed HTTP calls (5xx responses)
2. **High error rate**: `error_count > 10` in response stats
3. **No execution**: No telemetry logs for > 8 days
4. **Slow execution**: `duration_minutes > 30` (suggests blocking issue)

Example alert (AWS EventBridge + CloudWatch):

```json
{
  "MetricName": "FailedInvocations",
  "Threshold": 1,
  "ComparisonOperator": "GreaterThanOrEqualToThreshold",
  "EvaluationPeriods": 1,
  "Period": 3600
}
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-02  
**Next Review:** After first three Sunday executions (to confirm stability)
