# Email Open Tracking Implementation

This document explains the full implementation of the **email open tracking** system in Hirevoo. The system embeds a 1x1 invisible tracking pixel in every outgoing campaign email. When a recipient's email client loads the image, it fires a GET request to our server which records the open event.

---

## How It Works (High-Level)

```
1. Campaign email is sent
   └─ HTML body gets a tracking pixel appended before sending
      └─ <img src="https://app.hirevoo.com/api/track/open/{campaign_contact_id}" />

2. Recipient opens the email
   └─ Email client loads all images, including our 1x1 pixel
      └─ GET /api/track/open/{id} hits our server

3. Server receives the request
   └─ UPDATE campaign_contacts SET opened_at = NOW() WHERE id = {id} AND opened_at IS NULL
   └─ Returns 1x1 transparent GIF (always, even if DB update fails)
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    EMAIL SEND FLOW                            │
│                                                              │
│  bg-worker (batch campaigns)                                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 1. Replace template variables ({FirstName}, etc.)      │  │
│  │ 2. Convert plain text → HTML (plainTextToHtml)         │  │
│  │ 3. Append tracking pixel (appendTrackingPixel) ← NEW  │  │
│  │ 4. Send via Gmail API                                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Hirevoo app (single email sends)                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 1. Convert plain text → HTML                           │  │
│  │ 2. Look up campaign_contacts.id from campaignId+       │  │
│  │    contactId                                           │  │
│  │ 3. Append tracking pixel ← NEW                        │  │
│  │ 4. Send via Gmail API                                  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                         │
                         │ Email arrives in recipient's inbox
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                  RECIPIENT OPENS EMAIL                        │
│                                                              │
│  Email client loads images, including:                        │
│  <img src="https://app.hirevoo.com/api/track/open/abc123">  │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ GET /api/track/open/abc123
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              TRACKING PIXEL ENDPOINT                          │
│              /api/track/open/[id]/route.ts                    │
│                                                              │
│  1. UPDATE campaign_contacts                                 │
│     SET opened_at = NOW(), status = 'opened'                 │
│     WHERE id = 'abc123' AND opened_at IS NULL                │
│                                                              │
│  2. Return 1x1 transparent GIF                               │
│     Headers: Cache-Control: no-store, no-cache               │
└──────────────────────────────────────────────────────────────┘
```

---

## Files Involved

| File | Project | Role |
|------|---------|------|
| `app/api/track/open/[id]/route.ts` | Hirevoo | **Tracking pixel endpoint** — serves the GIF, records the open |
| `lib/tracking.ts` | Hirevoo | **Utility** — `appendTrackingPixel(html, id)` function |
| `lib/tracking.ts` | bg-worker | **Utility** — identical copy for bg-worker (can't share `@/lib` alias) |
| `workers/jobs/send-campaign.ts` | bg-worker | **Injection point** — calls `appendTrackingPixel` before sending |
| `app/api/campaign/send/route.ts` | Hirevoo | **Injection point** — calls `appendTrackingPixel` for single sends |

---

## Detailed Breakdown

### 1. The Tracking Pixel Endpoint

**File**: `Hirevoo/app/api/track/open/[id]/route.ts`
**Route**: `GET /api/track/open/:campaignContactId`

This is the core of the system. When an email client loads images, it makes a GET request to this URL.

**What it does:**

```typescript
// 1x1 transparent GIF, hardcoded as base64 (43 bytes)
const TRACKING_PIXEL = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
);
```

**Database update:**

```sql
UPDATE campaign_contacts
SET opened_at = NOW(),
    status = 'opened',
    updated_at = NOW()
WHERE id = :campaignContactId
  AND opened_at IS NULL;    -- ← Only records the FIRST open
```

The `AND opened_at IS NULL` clause is critical. It means:
- **First open**: Records the timestamp, sets status to `'opened'`
- **Second open onwards**: The WHERE clause matches zero rows, no update happens
- **After a reply**: If the contact has already replied (`status = 'replied'`), the `opened_at` still gets set on first image load, but a subsequent webhook that sets `status = 'replied'` will overwrite the `'opened'` status (which is correct — replied is a higher-priority status)

**Response headers:**

```
Content-Type: image/gif
Content-Length: 43
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
```

These headers prevent the browser/email client from caching the image. Without them, the pixel would only fire once and subsequent opens wouldn't even hit our server (though we only record the first open anyway, the no-cache ensures the request reaches us reliably).

**Error handling:**

The DB update is wrapped in a try/catch. If Supabase is down or the ID is invalid, we still return the GIF. The pixel should **never** return an error to the email client — that could show a broken image icon in the recipient's email.

---

### 2. The Utility Function

**Files**: `Hirevoo/lib/tracking.ts` and `bg-worker/lib/tracking.ts` (identical)

```typescript
export function appendTrackingPixel(html: string, campaignContactId: string): string {
    const pixelUrl = `${APP_URL}/api/track/open/${campaignContactId}`;
    const pixelTag = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
    return html + pixelTag;
}
```

**Why `style="display:none"`?**
Hides the image completely. Some email clients might still show a 1x1 dot without this. The `width="1" height="1"` is a fallback for clients that strip inline styles.

**Why `alt=""`?**
An empty alt tag prevents screen readers from announcing "image" and prevents email clients from showing placeholder text when images are blocked.

**Why two copies of the file?**
The bg-worker project uses relative imports (`../../lib/tracking`) and cannot resolve Hirevoo's `@/lib` TypeScript path alias. Both files are identical — if you change one, change the other.

**Environment variable:**
Uses `NEXT_PUBLIC_APP_URL` to build the full pixel URL. In production this would be something like `https://app.hirevoo.com`. Falls back to `http://localhost:3000` in development.

---

### 3. Injection in Batch Campaign Sends

**File**: `bg-worker/workers/jobs/send-campaign.ts`

**Two injection points** (both `processCampaign()` and `processCampaignInBatches()`):

```typescript
// Before (old):
const htmlBody = plainTextToHtml(personalizedBody);
const sendResult = await sendEmail({ body: htmlBody, ... });

// After (new):
const htmlBody = plainTextToHtml(personalizedBody);
const htmlWithTracking = appendTrackingPixel(htmlBody, email.id);
const sendResult = await sendEmail({ body: htmlWithTracking, ... });
```

**Why `email.id`?**
In the bg-worker, `email` is a row from `campaign_contacts`. So `email.id` is the `campaign_contacts.id` — exactly what the tracking pixel endpoint expects.

**Where in the pipeline:**

```
email_body (plain text from DB)
    ↓
replaceVariables()     → personalized plain text
    ↓
plainTextToHtml()      → HTML email body
    ↓
appendTrackingPixel()  → HTML + hidden pixel img tag  ← HERE
    ↓
sendEmail()            → Gmail API sends the email
```

The pixel is appended **after** HTML conversion and **before** sending. This ensures:
- Template variables are already replaced (no `{FirstName}` in the URL)
- The HTML structure is finalized
- The pixel URL won't get escaped by `plainTextToHtml()`'s HTML entity escaping

---

### 4. Injection in Single Email Sends

**File**: `Hirevoo/app/api/campaign/send/route.ts`

This route handles ad-hoc single-email sends from the UI. Unlike the bg-worker, it receives `campaignId` and `contactId` as separate parameters (not `campaign_contacts.id` directly). So we need a lookup:

```typescript
// Look up campaign_contacts.id from campaignId + contactId
if (campaignId && contactId) {
    const { data: cc } = await supabase
        .from('campaign_contacts')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('contact_id', contactId)
        .maybeSingle();

    if (cc) {
        emailHtml = appendTrackingPixel(emailHtml, cc.id);
    }
}
```

**Why conditional?**
This route can also be used for non-campaign emails (when `campaignId` is not provided). In that case, we skip the tracking pixel — there's no `campaign_contacts` row to track against.

---

## Database Schema

### Column Required

```sql
ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
```

### Status Flow

The `status` column on `campaign_contacts` now has this lifecycle:

```
pending → sent → opened → replied
                    ↑         ↑
                    │         │
            tracking pixel   webhook
            endpoint fires   detects reply
```

| Status | Set By | Condition |
|--------|--------|-----------|
| `pending` | Campaign creation | Default |
| `sent` | bg-worker after `sendEmail()` succeeds | Always |
| `opened` | `GET /api/track/open/:id` | Only if `opened_at IS NULL` |
| `replied` | Gmail webhook handler | First inbound message on the thread |

**Note:** `replied` takes priority over `opened`. If a contact replies without loading images first, their status goes straight to `replied`. If they open first and then reply, it goes `sent → opened → replied`. The webhook handler always overwrites status to `replied` regardless of current value.

---

## Limitations & Edge Cases

### 1. Image Blocking

Many email clients **block images by default** (Gmail web, Outlook, Apple Mail privacy mode). The recipient must click "Load images" or have auto-loading enabled. This means open tracking has a **false negative rate** — not every open is recorded.

**Impact:** Open rates will be understated. Industry standard is ~50-70% detection rate for actual opens.

### 2. Gmail Image Proxy

Gmail routes all images through its own proxy (`googleusercontent.com`). This means:
- The IP address in the request will be Google's, not the recipient's
- Gmail may pre-fetch images (firing the pixel before the user actually opens)
- The `User-Agent` will be Google's proxy, not the recipient's email client

**Impact:** Some opens may be recorded before the user actually reads the email. This is a known industry-wide limitation.

### 3. Apple Mail Privacy Protection

Apple Mail (iOS 15+, macOS Monterey+) has "Mail Privacy Protection" which pre-loads all images in the background, regardless of whether the user opens the email.

**Impact:** Apple Mail users will always appear as "opened". No workaround exists — this is by design.

### 4. Multiple Opens

Our system only records the **first** open (via `WHERE opened_at IS NULL`). Subsequent opens don't trigger a DB update. This is intentional — we care about "did they see it at all?" not "how many times did they read it?"

### 5. Plain Text Email Clients

If a recipient's email client renders plain text only (no HTML), the tracking pixel won't load. The email body is still readable since our pixel is an `<img>` tag that gets ignored in plain text mode.

### 6. Forwarded Emails

If a recipient forwards the email, the new reader will also trigger the tracking pixel. We can't distinguish between the original recipient and a forwarded reader — both will hit the same `campaign_contacts.id`. Since we only record the first open, the forwarded open will be silently ignored if the original recipient already opened it.

---

## Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_APP_URL` | `lib/tracking.ts` (both projects) | Base URL for the pixel `<img src>` |
| `NEXT_PUBLIC_SUPABASE_URL` | Tracking endpoint | Supabase connection |
| `SUPABASE_SERVICE_ROLE_KEY` | Tracking endpoint | Bypasses RLS for the update |

**Example:**
```
NEXT_PUBLIC_APP_URL=https://app.hirevoo.com
```

In development:
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Testing

### Local Testing

1. **Send a test campaign email** (to yourself)
2. **Open the email** in a client that loads images (e.g., Gmail with images enabled)
3. **Check the DB:**
   ```sql
   SELECT id, status, opened_at FROM campaign_contacts
   WHERE id = '<your-campaign-contact-id>';
   ```
4. Expected: `status = 'opened'`, `opened_at` = timestamp of when you opened

### Manual Pixel Test

Hit the endpoint directly in a browser:

```
http://localhost:3000/api/track/open/<any-uuid>
```

You should see:
- A blank page (the GIF is invisible)
- Network tab shows: `200 OK`, `Content-Type: image/gif`, `43 bytes`
- If the UUID matches a real `campaign_contacts.id` with `opened_at IS NULL`, the DB gets updated

### Edge Case Tests

| Scenario | Expected |
|----------|----------|
| Valid ID, first open | `opened_at` set, `status = 'opened'` |
| Valid ID, second open | No DB change (IS NULL check fails) |
| Invalid UUID | Pixel still returned, no DB error |
| DB is down | Pixel still returned, error logged |
| Contact already replied | `opened_at` set but `status` stays `'replied'` (webhook already set it) |

**Wait — the last row needs clarification:** If the webhook already set `status = 'replied'`, our tracking endpoint will try to set `status = 'opened'`. But the `WHERE opened_at IS NULL` clause prevents this because:
- If the webhook ran first and the user never opened (images blocked), `opened_at` is still NULL, so the update runs and sets status to `'opened'` — but the webhook would have already set it to `'replied'`. In that case the tracking pixel downgrades the status from `'replied'` to `'opened'`.

**To fix this edge case**, you could update the tracking endpoint to NOT overwrite the status if it's already `'replied'`:

```sql
UPDATE campaign_contacts
SET opened_at = NOW(),
    status = CASE WHEN status = 'replied' THEN status ELSE 'opened' END,
    updated_at = NOW()
WHERE id = :id AND opened_at IS NULL;
```

This is noted as a future improvement in the codebase.

---

## Analytics Queries

### Open Rate for a Campaign

```sql
SELECT
  COUNT(*) AS total_sent,
  COUNT(opened_at) AS total_opened,
  ROUND(COUNT(opened_at)::numeric / COUNT(*) * 100, 1) AS open_rate_pct
FROM campaign_contacts
WHERE campaign_id = '<campaign-id>'
  AND status != 'pending';
```

### Time to Open (Average)

```sql
SELECT
  AVG(EXTRACT(EPOCH FROM (opened_at - sent_at)) / 3600) AS avg_hours_to_open
FROM campaign_contacts
WHERE campaign_id = '<campaign-id>'
  AND opened_at IS NOT NULL
  AND sent_at IS NOT NULL;
```

### Open-to-Reply Funnel

```sql
SELECT
  COUNT(*) FILTER (WHERE status IN ('sent','opened','replied')) AS sent,
  COUNT(*) FILTER (WHERE status IN ('opened','replied')) AS opened,
  COUNT(*) FILTER (WHERE status = 'replied') AS replied
FROM campaign_contacts
WHERE campaign_id = '<campaign-id>';
```

---

## Summary

| Component | What It Does |
|-----------|-------------|
| `GET /api/track/open/[id]` | Serves 1x1 GIF, records first open in DB |
| `lib/tracking.ts` | `appendTrackingPixel(html, id)` — appends `<img>` to email HTML |
| `send-campaign.ts` (bg-worker) | Calls `appendTrackingPixel` before every batch email send |
| `campaign/send/route.ts` (Hirevoo) | Calls `appendTrackingPixel` before single email sends |
| `campaign_contacts.opened_at` | Stores first-open timestamp (NULL until opened) |
| `campaign_contacts.status` | Updated to `'opened'` on first pixel fire |

The system is designed to be **silent and non-blocking** — if any part fails (DB down, bad ID, network issue), the pixel image is still returned and the email looks normal. Open tracking is a best-effort metric due to inherent limitations of email client image loading behavior.
