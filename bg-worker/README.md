# Hirevoo Background Worker System

A production-grade background worker system for processing email campaigns asynchronously using BullMQ and Redis.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Complete Flow](#complete-flow)
4. [Real-Life Examples](#real-life-examples)
5. [How to Run](#how-to-run)
6. [Troubleshooting](#troubleshooting)
7. [Production Deployment](#production-deployment)

---

## Overview

### What This System Does

When a user clicks "Send Campaign" in Hirevoo:

1. **Instant Response**: The user gets confirmation within 300ms
2. **Background Processing**: A separate worker process sends emails over 10-15 minutes
3. **Reliability**: If the worker crashes, BullMQ automatically retries the job

### Why Background Workers?

Imagine a restaurant:
- **Without workers**: The waiter takes your order, goes to the kitchen, cooks the food, and only then takes the next order. If cooking takes 30 minutes, everyone waits.
- **With workers**: The waiter takes your order (instant), gives it to the kitchen (queue), and serves other customers. The kitchen (worker) processes orders in the background.

This system works the same way:
- **API Route** = Waiter (takes order, responds instantly)
- **Redis Queue** = Order tickets hanging in the kitchen
- **Worker Process** = Kitchen staff (processes orders in background)
- **Redis Pub/Sub** = Bell that dings when your order is ready

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                                    │
│                                                                             │
│  1. Click "Send Campaign"                                                   │
│  2. Get instant response (< 300ms)                                          │
│  3. Can close browser - emails still send!                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP POST /api/campaigns/[id]/send
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TERMINAL 1: NEXT.JS PROCESS                              │
│                         (npm run dev)                                       │
│                                                                             │
│  ┌───────────────────────┐                                                 │
│  │   API Route           │                                                 │
│  │                       │                                                 │
│  │ - Validates request   │                                                 │
│  │ - Checks permissions  │                                                 │
│  │ - Queues job to Redis │                                                 │
│  │ - Returns job ID      │                                                 │
│  └───────────────────────┘                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Redis
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REDIS (Upstash)                                     │
│                                                                             │
│  ┌───────────────────────────────┐    ┌─────────────────────────────────┐  │
│  │       JOB QUEUE (BullMQ)      │    │         PUB/SUB CHANNELS        │  │
│  │                               │    │                                 │  │
│  │  Job 1: campaign-abc123       │    │  Channel: email:sent            │  │
│  │  Job 2: campaign-def456       │    │  Channel: email:failed          │  │
│  │  Job 3: campaign-ghi789       │    │  Channel: campaign:complete     │  │
│  │                               │    │                                 │  │
│  └───────────────────────────────┘    └─────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Worker picks jobs & publishes events
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TERMINAL 2: WORKER PROCESS                               │
│                         (npm run worker)                                    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         JOB PROCESSOR                                  │  │
│  │                                                                        │  │
│  │  For each job:                                                         │  │
│  │  1. Fetch pending emails from Supabase                                 │  │
│  │  2. Loop through each email:                                           │  │
│  │     a. Send via Gmail API                                              │  │
│  │     b. Update database (status = 'sent')                               │  │
│  │     c. Publish progress to Redis Pub/Sub                               │  │
│  │     d. Wait 200ms (rate limiting)                                      │  │
│  │  3. Mark campaign as complete                                          │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
hirevoo/
├── app/
│   └── api/
│       └── campaigns/
│           └── [id]/
│               └── send/
│                   └── route.ts         # API endpoint (validates & queues)
│
├── lib/
│   ├── queue/
│   │   ├── config.ts                    # Redis connection setup
│   │   └── email-queue.ts               # BullMQ queue configuration
│   │
│   └── services/
│       └── email-service.ts             # Gmail API wrapper
│
└── workers/
    ├── index.ts                         # Worker entry point
    └── jobs/
        └── send-campaign.ts             # Campaign processing logic
```

---

## Complete Flow

### Step-by-Step: User Sends Campaign with 3 Emails

Let's trace exactly what happens when Sarah clicks "Send Campaign" at **2:00:00.000 PM**.

---

#### Step 1: Button Click (2:00:00.000 PM)

**Location:** Browser (React component)

**What happens:**
```javascript
// User clicks "Send Campaign" button
const response = await fetch(`/api/campaigns/${campaignId}/send`, {
  method: 'POST'
});
```

**Network:** HTTP POST request sent to server

---

#### Step 2: API Route Receives Request (2:00:00.050 PM)

**Location:** `app/api/campaigns/[id]/send/route.ts`

**What happens:**
1. Extract campaign ID from URL params
2. Authenticate user via NextAuth session
3. Query database: Does campaign exist? Does user own it?
4. Check: Is Gmail connected?
5. Count pending emails (3 emails found)
6. Check daily limit (150/500 used, 350 remaining)

**Database queries:** 3 queries (~40ms total)

---

#### Step 3: Job Queued to Redis (2:00:00.100 PM)

**Location:** `lib/queue/email-queue.ts`

**What happens:**
```typescript
const { jobId, queuePosition } = await queueCampaignSend(campaignId, userId);
// jobId = "campaign-abc123"
// queuePosition = 1
```

**Redis command:** `XADD bull:hirevoo:emails:... { campaignId, userId, queuedAt }`

---

#### Step 4: API Returns Response (2:00:00.150 PM)

**Location:** `app/api/campaigns/[id]/send/route.ts`

**Response sent to browser:**
```json
{
  "success": true,
  "message": "Campaign queued! Sending 3 emails in background.",
  "jobId": "campaign-abc123",
  "queuePosition": 1,
  "pendingEmails": 3,
  "estimatedDurationSeconds": 1
}
```

**Total API response time:** 150ms ✅ (under 300ms target)

**Sarah sees:** Success toast notification, can close browser

---

#### Step 5: Worker Picks Up Job (2:00:00.200 PM)

**Location:** `workers/index.ts` (Terminal 2)

**Console output:**
```
────────────────────────────────────────────────────────────────
[Worker][Job:campaign-abc123] 📥 Job received
────────────────────────────────────────────────────────────────
  Job ID:     campaign-abc123
  Campaign:   abc12345-6789-...
  User:       user1234-5678-...
  Queued at:  2024-01-15T14:00:00.100Z
  Attempt:    1/3
```

---

#### Step 6: Fetch Pending Emails (2:00:00.250 PM)

**Location:** `workers/jobs/send-campaign.ts`

**Database query:**
```sql
SELECT * FROM campaign_contacts
WHERE campaign_id = 'abc123' AND status = 'pending'
ORDER BY created_at ASC
```

**Result:** 3 emails returned

```
[Job:campaign-abc123] 📧 Found 3 pending emails to send
```

---

#### Step 7: Send Email 1 (2:00:00.300 PM → 2:00:00.800 PM)

**Location:** `lib/services/email-service.ts`

**What happens:**
1. Fetch Gmail tokens from database (50ms)
2. Check token expiration (not expired)
3. Create Gmail API client
4. Format email (RFC 2822)
5. Send via Gmail API (400ms)

**Gmail API response:**
```json
{
  "id": "msg-111",
  "threadId": "thread-111"
}
```

**Database update:**
```sql
UPDATE campaign_contacts
SET status = 'sent', sent_at = NOW()
WHERE id = 'email-1'
```

**Redis Pub/Sub publish:**
```json
{
  "channel": "email:sent",
  "data": {
    "userId": "user-abc",
    "campaignId": "abc123",
    "emailId": "email-1",
    "progress": 33,
    "sent": 1,
    "failed": 0,
    "total": 3
  }
}
```

**Console output:**
```
[Job:campaign-abc123][1/3] ✅ Sent to alice@example.com (Message ID: msg-111)
```

---

#### Step 8: Rate Limit Delay (2:00:00.850 PM → 2:00:01.050 PM)

**Location:** `workers/jobs/send-campaign.ts`

**What happens:**
```typescript
await delay(200); // Respect Gmail rate limits
```

---

#### Step 9: Send Email 2 (2:00:01.050 PM → 2:00:01.550 PM)

Similar to Step 7, but for the second email.

**Console output:**
```
[Job:campaign-abc123][2/3] ✅ Sent to bob@example.com (Message ID: msg-222)
```

**Progress:** 66% (2/3 sent)

---

#### Step 10: Send Email 3 (2:00:01.750 PM → 2:00:02.250 PM)

Similar to Step 7, but for the third email.

**Console output:**
```
[Job:campaign-abc123][3/3] ✅ Sent to carol@example.com (Message ID: msg-333)
```

**Progress:** 100% (3/3 sent)

---

#### Step 11: Campaign Complete (2:00:02.300 PM)

**Location:** `workers/jobs/send-campaign.ts`

**Database update:**
```sql
UPDATE campaigns
SET status = 'sent', sent_at = NOW()
WHERE id = 'abc123'
```

**Redis Pub/Sub publish:**
```json
{
  "channel": "campaign:complete",
  "data": {
    "userId": "user-abc",
    "campaignId": "abc123",
    "totalSent": 3,
    "totalFailed": 0,
    "duration": 2
  }
}
```

**Console output:**
```
[Job:campaign-abc123] 🎉 Campaign processing complete!
────────────────────────────────────
   Total Processed: 3
   Successful: 3 ✅
   Failed: 0 ❌
   Duration: 2 seconds
────────────────────────────────────
```

---

## Real-Life Examples

### Scenario 1: Campaign with 100 Emails, All Succeed

**Timeline:**
- **0:00** - User clicks "Send"
- **0:00.15** - API responds with job ID
- **0:00.25** - Worker picks up job
- **0:00.30** - First email sent
- **0:20** - 50% complete (50 emails sent)
- **0:40** - 100% complete (100 emails sent)
- **0:40.5** - Campaign marked as "sent"

**Worker output:**
```
[Job:xyz] 📧 Found 100 pending emails to send
[Job:xyz][1/100] ✅ Sent to user1@example.com
[Job:xyz][2/100] ✅ Sent to user2@example.com
...
[Job:xyz][100/100] ✅ Sent to user100@example.com
[Job:xyz] 🎉 Campaign processing complete!
   Successful: 100 ✅
   Failed: 0 ❌
   Duration: 40 seconds
```

---

### Scenario 2: Campaign with 50 Emails, 3 Fail (Invalid Addresses)

**Timeline:**
- **0:00** - User clicks "Send"
- **0:10** - Email #12 fails (invalid address: `not-an-email`)
- **0:10** - Worker continues to email #13 (doesn't stop!)
- **0:15** - Email #25 fails (address doesn't exist)
- **0:18** - Email #33 fails (Gmail rejects recipient)
- **0:20** - All 50 processed

**Worker output:**
```
[Job:xyz][12/50] ❌ Failed to send to not-an-email: INVALID_RECIPIENT
[Job:xyz][13/50] ✅ Sent to valid@example.com
...
[Job:xyz][25/50] ❌ Failed to send to bounce@example.com: INVALID_RECIPIENT
...
[Job:xyz] 🎉 Campaign processing complete!
   Successful: 47 ✅
   Failed: 3 ❌
```

**Database state:**
```sql
-- campaign_contacts table
id       | status  | error_message
---------|---------|---------------------------
email-12 | failed  | Invalid email format
email-25 | failed  | Invalid recipient email
email-33 | failed  | Gmail rejected recipient
```

---

### Scenario 3: Worker Crashes Mid-Campaign (Recovery)

**Timeline:**
- **0:00** - Campaign starts (100 emails)
- **0:15** - Worker sends 40 emails
- **0:15** - Worker process crashes (Out of Memory)
- **0:15** - Job becomes "stalled" in BullMQ
- **0:15.30** - BullMQ detects stall, marks job for retry
- **0:16** - New worker picks up job (attempt 2 of 3)
- **0:16.05** - Worker queries database: only 60 pending emails left!
- **0:16.10** - Worker continues from email 41
- **0:30** - All 100 emails sent

**Why this works:**
1. Each email is marked `status = 'sent'` immediately after sending
2. When job retries, we query `WHERE status = 'pending'`
3. Already-sent emails are skipped automatically
4. **Idempotency** = Safe to retry without duplicates!

**Worker output (after crash):**
```
╔═══════════════════════════════════════════════════════════════╗
║   HIREVOO EMAIL WORKER                                        ║
╚═══════════════════════════════════════════════════════════════╝

[Worker][Job:xyz] 📥 Job received
  Attempt:    2/3  ← Note: This is a retry

[Job:xyz] 📧 Found 60 pending emails to send  ← Only remaining emails!
[Job:xyz][1/60] ✅ Sent to user41@example.com
...
```

---

## How to Run

### Prerequisites

1. **Node.js 18+**
2. **Redis** (local or Upstash)
3. **Supabase** project with required tables
4. **Gmail API** credentials

### Step 1: Install Dependencies

```bash
npm install bullmq ioredis googleapis @supabase/supabase-js tsx
```

### Step 2: Set Up Environment Variables

Create `.env.local`:

```env
# Redis (Upstash)
REDIS_URL=rediss://default:your-password@your-region.upstash.io:6379

# Gmail API
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
```

### Step 3: Run the System

**Terminal 1 - Next.js Application:**
```bash
npm run dev
```

Expected output:
```
▲ Next.js 14.x
- Local:        http://localhost:3000
- Environments: .env.local

✓ Ready in 2.3s
```

**Terminal 2 - Background Worker:**
```bash
npm run worker
```

Expected output:
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 HIREVOO EMAIL WORKER                                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

📅 Started at: 2024-01-15T14:00:00.000Z
📡 Redis URL: rediss://default:***@xyz.upstash...
⚙️  Concurrency: 1 job(s)
📋 Queue: emails

[Redis:bullmq-main] ✅ Connection ready.

╔═══════════════════════════════════════════════════════════════╗
║  ✅ WORKER READY                                              ║
║                                                               ║
║  Watching for jobs on queue: emails                           ║
╚═══════════════════════════════════════════════════════════════╝
```

### Step 4: Test the System

1. Open browser to `http://localhost:3000`
2. Log in and create a campaign
3. Add recipients
4. Click "Send Campaign"
5. Watch Terminal 2 for processing logs
6. See progress updates in browser

---

## Troubleshooting

### Problem: Worker Not Picking Up Jobs

**Symptoms:**
- API returns success with job ID
- Worker shows "Watching for jobs..." but nothing happens

**Solutions:**

1. **Check Redis connection:**
   ```bash
   # In worker terminal, you should see:
   [Redis:bullmq-main] ✅ Connection ready.
   ```

2. **Verify queue name matches:**
   ```typescript
   // email-queue.ts
   export const emailQueue = new Queue('emails', ...);

   // workers/index.ts
   const worker = new Worker('emails', ...);
   ```

3. **Check Redis URL:**
   ```bash
   # Make sure REDIS_URL is set correctly
   echo $REDIS_URL
   ```

---

### Problem: "Campaign already being processed" Error

**Cause:** Job with same campaign ID already exists in queue

**Solution:**
```typescript
// In email-queue.ts, we use campaignId as jobId for idempotency
const jobId = `campaign-${campaignId}`;

// To allow re-sending, the previous job must be in 'completed' or 'failed' state
```

---

### Problem: Gmail API Rate Limit Errors

**Symptoms:**
- Emails fail with "RATE_LIMITED" error code
- Worker retries but keeps failing

**Solution:**

Increase delay between emails:
```typescript
// In send-campaign.ts
await delay(500); // Increase from 200ms to 500ms
```

---

### Problem: Token Refresh Failing

**Symptoms:**
- Emails fail with "TOKEN_INVALID" error
- Error: "Gmail session expired and could not be renewed"

**Solution:**

1. User needs to reconnect Gmail in Settings
2. Check Gmail OAuth app is not in "Testing" mode (has publishing restrictions)
3. Verify refresh token is stored correctly in database

---

## Production Deployment

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL                                   │
│                                                                 │
│   Next.js Application (API routes)                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       UPSTASH REDIS                             │
│                                                                 │
│   - Serverless Redis (auto-scaling)                             │
│   - BullMQ job queue                                            │
│   - Pub/Sub for real-time events                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RAILWAY / FLY.IO                            │
│                                                                 │
│   Worker Process (always running, picks up jobs)                │
│                                                                 │
│   - Configure as "always on" (not serverless)                   │
│   - Set memory limits (512MB recommended)                       │
│   - Configure health checks                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Vercel Configuration

```json
// vercel.json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 10
    }
  }
}
```

### Railway Configuration

```toml
# railway.toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm run worker:prod"
healthcheckPath = "/health"
healthcheckTimeout = 300
```

### Environment Variables (Production)

```env
# Set these in your deployment platform
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GMAIL_CLIENT_ID=xxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=xxx
```

### Monitoring Recommendations

1. **Log aggregation:** Use Papertrail, Logtail, or similar
2. **Error tracking:** Sentry for error monitoring
3. **Uptime monitoring:** Better Uptime, Pingdom
4. **Redis monitoring:** Upstash dashboard

### Scaling Considerations

1. **Multiple workers:** Run 2-3 worker instances for redundancy
2. **Concurrency:** Increase worker concurrency for higher throughput
3. **Redis:** Upstash auto-scales, but monitor connection limits
4. **Gmail limits:** Consider multiple Gmail accounts for high volume

---

## API Reference

### POST /api/campaigns/[id]/send

Queues a campaign for background sending.

**Request:**
```http
POST /api/campaigns/abc123/send
Authorization: Bearer <session-token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Campaign queued! Sending 50 emails in background.",
  "jobId": "campaign-abc123",
  "queuePosition": 1,
  "pendingEmails": 50,
  "estimatedDurationSeconds": 11
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 401 | UNAUTHORIZED | User not logged in |
| 403 | FORBIDDEN | User doesn't own campaign |
| 404 | CAMPAIGN_NOT_FOUND | Campaign doesn't exist |
| 400 | GMAIL_NOT_CONNECTED | Gmail not linked |
| 400 | NO_PENDING_EMAILS | No emails to send |
| 409 | ALREADY_SENDING | Campaign already in progress |
| 429 | DAILY_LIMIT_EXCEEDED | Daily send limit reached |

### GET /api/campaigns/[id]/send

Gets current job status for a campaign.

**Response:**
```json
{
  "success": true,
  "hasJob": true,
  "job": {
    "id": "campaign-abc123",
    "state": "active",
    "progress": 65,
    "attemptsMade": 1,
    "result": null,
    "failedReason": null
  }
}
```

---

## License

MIT
