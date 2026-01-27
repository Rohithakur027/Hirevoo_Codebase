# Gmail Connection Bug — Debugging Report

## Symptom

After connecting Gmail on the frontend (completing the full Google OAuth flow), the app still reported Gmail as **not connected**. The status endpoint always returned:

```json
{ "isConnected": false, "permissionLevel": null, "email": null }
```

The Supabase `users` table showed `gmail_connected: false` even after a successful OAuth callback.

---

## Root Causes (Two Bugs Found)

### Bug 1: `request.json()` failing in the Connect Route

**File:** `app/api/auth/gmail/connect/route.ts`

**What happened:**
The POST handler called `getServerSession(authOptions)` before `request.json()`. In Next.js, the request body stream can only be consumed once. `getServerSession` was consuming it internally, so by the time `request.json()` ran, the body was empty, throwing:

```
SyntaxError: Unexpected end of JSON input
    at POST (app/api/auth/gmail/connect/route.ts:19:36)
```

This meant the connect route returned a 500 error, the frontend never redirected to Google OAuth, and the callback was never triggered. However, in some cases (or after a retry), the OAuth flow did complete and reached the callback — where Bug 2 was waiting.

**Fix:**
Read the request body (`request.text()` + `JSON.parse()`) **before** calling `getServerSession()`, with a try/catch defaulting to `FULL_ACCESS` if parsing fails.

---

### Bug 2: Non-existent `gmail_refresh_token` Column (The Main Blocker)

**File:** `app/api/auth/gmail/callback/route.ts` and `lib/gmail/client.ts`

**What happened:**
The Supabase `users` table uses **encrypted** token storage with three columns:
- `gmail_refresh_token_IV`
- `gmail_refresh_token_content`
- `gmail_refresh_token_tag`

There is **no** legacy `gmail_refresh_token` plaintext column. But the code referenced it in two places:

**1. Callback route (line 97) — WRITE failure:**
```ts
// This line was included in the update payload
updateData.gmail_refresh_token = null;
```

When Supabase received an update payload containing a column that doesn't exist, it rejected the **entire update** with error:

```
{
  code: 'PGRST204',
  message: "Could not find the 'gmail_refresh_token' column of 'users' in the schema cache"
}
```

This meant `gmail_connected: true` was **never written** to the database, even though the OAuth flow completed successfully and tokens were received from Google.

**2. Gmail client (line 114) — READ failure:**
```ts
.select('gmail_refresh_token, gmail_refresh_token_IV, gmail_refresh_token_content, gmail_refresh_token_tag')
```

This `select()` also referenced the non-existent column, which would cause token reads to fail too (preventing email sending even if the connection had been saved).

**Fix:**
- Removed `updateData.gmail_refresh_token = null` from the callback route
- Removed `gmail_refresh_token` from the `select()` query in `lib/gmail/client.ts`
- Removed the legacy plaintext fallback logic in `getUserTokens()` since only encrypted storage exists

---

## Additional Improvement: saveUserToSupabase Upsert

**File:** `lib/auth.ts`

**What happened:**
The `saveUserToSupabase()` function ran on **every Google sign-in** using a POST upsert with `Prefer: resolution=merge-duplicates`. With Supabase's REST API merge-duplicates strategy, columns not included in the payload can be reset to their default values. This risked resetting `gmail_connected` back to `false` on every login.

**Fix:**
Changed from a blind upsert to a check-then-act pattern:
- If user exists: PATCH only `name` and `updated_at` (leaves Gmail columns untouched)
- If user is new: POST with full defaults

---

## Debugging Timeline

1. **Initial observation:** Status endpoint logs showed `DB Connected Flag: false` for a valid user ID
2. **First hypothesis:** The upsert in `saveUserToSupabase` was resetting `gmail_connected` on each login — fixed this preemptively
3. **Added logging to callback route** — discovered the connect route was crashing before OAuth redirect
4. **Fixed connect route** (body stream issue) — OAuth flow completed but DB still showed not connected
5. **Logs revealed the real error:** `PGRST204 — Could not find the 'gmail_refresh_token' column` — the entire update was rejected because of one non-existent column in the payload
6. **Removed references to `gmail_refresh_token`** in both callback route and Gmail client — fix confirmed working

---

## Files Changed

| File | Change |
|------|--------|
| `app/api/auth/gmail/connect/route.ts` | Read request body before `getServerSession()` |
| `app/api/auth/gmail/callback/route.ts` | Removed `gmail_refresh_token = null` from update payload; added diagnostic logging |
| `lib/gmail/client.ts` | Removed `gmail_refresh_token` from select query; removed legacy plaintext fallback |
| `lib/auth.ts` | Changed upsert to check-then-act to prevent resetting Gmail columns on login |

---

## Key Takeaway (Bugs 1 & 2)

Supabase's PostgREST API rejects the **entire operation** if any column in the payload doesn't exist — it doesn't silently ignore unknown columns. The `.update()` call returned an error but no rows were updated, and the original code wasn't checking for this error properly (it only logged "Database update successful" without verifying row count). Always validate that columns exist in the schema before referencing them in queries.

---
---

# Bug 3: Background Worker Using Old Token Schema (Non-existent Columns)

## Symptom

After Bugs 1 & 2 were fixed and Gmail connected successfully in the main app, **sending campaigns via the background worker** still failed:

```
[EmailService] Failed to fetch tokens for user e94656c9-ecc9-4fb2-a689-c04de3c70d5c: {
  code: '42703',
  message: 'column users.gmail_access_token does not exist'
}
```

The worker reported `TOKEN_INVALID` and every email in the campaign failed.

## Root Cause

The project has **two separate services**:

1. **Hirevoo** (Next.js app) — handles OAuth, settings UI, status checks
2. **bg-worker** (standalone Node.js process) — picks jobs from BullMQ queue and sends emails

When the main app was migrated to encrypted token storage (3-column schema), the bg-worker at `bg-worker/lib/services/email-service.ts` was **never updated**. It still referenced the old schema:

```ts
// bg-worker was selecting columns that DON'T EXIST in the database
.select('gmail_access_token, gmail_refresh_token, gmail_token_expires_at')
```

The actual database schema uses:
- `gmail_refresh_token_IV` (encryption initialization vector)
- `gmail_refresh_token_content` (encrypted token data)
- `gmail_refresh_token_tag` (AES-GCM authentication tag)

There is no `gmail_access_token` column — the main app never stores access tokens in the DB. It refreshes them on-the-fly from the refresh token every time.

The bg-worker also had an `updateUserGmailTokens()` function that tried to write back `gmail_access_token` and `gmail_token_expires_at` — both non-existent columns.

## Fix

### Step 1: Create encryption module for bg-worker

Created `bg-worker/lib/encryption.ts` with the `decrypt()` function (same AES-256-GCM algorithm as the main app) so the worker can decrypt the stored tokens.

### Step 2: Rewrite token management in email-service.ts

| Function | Before (broken) | After (fixed) |
|----------|-----------------|---------------|
| `getUserGmailTokens()` | Selected `gmail_access_token, gmail_refresh_token, gmail_token_expires_at` | Selects `gmail_refresh_token_IV, gmail_refresh_token_content, gmail_refresh_token_tag` and decrypts |
| `updateUserGmailTokens()` | Stored access token + expiry in DB | **Removed entirely** — access tokens are never stored |
| `isTokenExpired()` | Checked expiry from DB column | **Removed** — always refresh since token isn't stored |
| `refreshAccessToken()` | Refreshed + wrote to DB | Replaced with `getAccessToken()` that only refreshes in-memory |
| `sendEmail()` | Used `tokens.accessToken` / `tokens.expiresAt` | Uses `getAccessToken(userId, tokens.refreshToken)` |
| `getGmailAddress()` | Used `tokens.accessToken` directly | Gets fresh token via `getAccessToken()` |

### Step 3: Also fixed disconnect route

`app/api/auth/gmail/disconnect/route.ts` also referenced the old columns for revoking tokens. Updated to decrypt the encrypted token before revoking at Google, and null out the correct 3 columns on disconnect.

### Step 4: Also fixed webhook route

`app/api/webhooks/gmail/route.ts` had the same legacy pattern with `gmail_refresh_token` fallback. Cleaned up to use only the encrypted columns.

## Files Changed

| File | Change |
|------|--------|
| `bg-worker/lib/encryption.ts` | **New file** — `decrypt()` function for AES-256-GCM |
| `bg-worker/lib/services/email-service.ts` | Rewrote token management to use encrypted 3-column schema |
| `app/api/auth/gmail/disconnect/route.ts` | Switched from old columns to encrypted columns + decrypt for revocation |
| `app/api/webhooks/gmail/route.ts` | Removed `gmail_refresh_token` from select; removed legacy fallback |

---
---

# Bug 4: Encryption Key Not Available at Module Load Time (bg-worker)

## Symptom

After Bug 3 was fixed, the bg-worker could now query the correct columns, but **decryption itself failed**:

```
[EmailService] Failed to decrypt token for user e94656c9-...:
Error: Unsupported state or unable to authenticate data
    at Decipheriv.final (node:internal/crypto/cipher:184:29)
    at decrypt (bg-worker/lib/encryption.ts:23:27)
```

`Unsupported state or unable to authenticate data` is the AES-256-GCM error when you try to decrypt data with the **wrong key**. The encrypted data from the DB was valid (the main app could decrypt it), but the bg-worker was using an all-zero key.

## Root Cause: Module Load Order vs. dotenv Timing

This is a **JavaScript module initialization order** bug. Here's how Node.js processes imports:

```
workers/index.ts (entry point)
├── Line 2: import dotenv          ← dotenv module loads
├── Line 3: dotenv.config()        ← .env.local loaded into process.env ✅
├── ...
└── Eventually imports email-service.ts
    ├── Line 20: import dotenv     ← redundant, already loaded
    ├── Line 24: import { decrypt } from '../encryption'
    │   └── encryption.ts loads:
    │       └── const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY  ← ⚠️ WHEN does this run?
    └── Line 21: dotenv.config()   ← redundant
```

The critical issue: **ES module `import` statements are hoisted and resolved before any code in the importing module runs.** When `email-service.ts` is processed:

1. All `import` statements are collected and resolved first
2. `encryption.ts` loads and its top-level code executes — reads `process.env.ENCRYPTION_KEY`
3. **Only then** does line 21 (`dotenv.config()`) execute in `email-service.ts`

In practice, the entry point `workers/index.ts` loads dotenv at line 3 before importing anything else, so `process.env.ENCRYPTION_KEY` *should* be set. However, depending on the module resolution graph and bundler behavior, the `encryption.ts` module could be evaluated before `dotenv.config()` runs. When that happens:

```ts
// encryption.ts — OLD CODE (evaluated at module load time)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY       // undefined!
    ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')    // skipped
    : Buffer.alloc(32);                                  // ← 32 zero bytes used as key
```

The key becomes `Buffer.alloc(32)` — 32 zero bytes. AES-GCM then tries to decrypt the data with this wrong key and fails with "unable to authenticate data".

## Fix Strategy: Lazy Key Resolution

Instead of reading the key once at module load time (eager), read it **at call time** (lazy):

```ts
// encryption.ts — NEW CODE (evaluated when decrypt() is called)
function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is not set.');
    }
    return Buffer.from(key, 'hex');
}

export function decrypt(data: { salt: string, content: string, tag: string }): string {
    const encryptionKey = getEncryptionKey();  // ← read at call time, not import time
    // ... rest of decryption
}
```

By the time `decrypt()` is actually called (during a job processing), `dotenv.config()` has definitely already run, so `process.env.ENCRYPTION_KEY` is guaranteed to be available.

### Why lazy initialization is the right pattern here

| Approach | Pros | Cons |
|----------|------|------|
| **Eager** (top-level const) | Slightly faster (key parsed once) | Breaks if env not loaded yet; silent fallback to wrong key |
| **Lazy** (function call) | Always correct regardless of import order; fails loudly if key missing | Tiny overhead per call (negligible) |

For cryptographic keys, **correctness > performance**. A silent fallback to a wrong key is catastrophic — it means data can't be decrypted and the error message (`unable to authenticate data`) doesn't clearly indicate the real problem (missing env variable).

## Files Changed

| File | Change |
|------|--------|
| `bg-worker/lib/encryption.ts` | Changed from eager top-level `const` to lazy `getEncryptionKey()` function; added explicit error if key is missing |

---
---

# Summary of All Bugs

| # | Bug | Where | Error | Root Cause |
|---|-----|-------|-------|------------|
| 1 | Request body consumed before reading | `connect/route.ts` | `Unexpected end of JSON input` | `getServerSession()` consumed request stream before `request.json()` |
| 2 | Non-existent column in DB payload | `callback/route.ts`, `client.ts` | `PGRST204` — column not found | Code referenced `gmail_refresh_token` which doesn't exist in schema |
| 3 | bg-worker using old token schema | `bg-worker/email-service.ts` | `42703` — column not found | Worker never migrated to encrypted 3-column token storage |
| 4 | Encryption key all zeros | `bg-worker/encryption.ts` | `unable to authenticate data` | Key read at module load time before dotenv loaded env vars |

## Debugging Strategy Used

1. **Follow the logs** — Every fix started by reading the exact error message in server logs
2. **Add diagnostic logging** — When the error wasn't clear, added logs to capture DB query results, row counts, and verification reads
3. **Trace the full flow** — Connect → Callback → DB Write → Status Read → Worker Send. Each step was verified independently
4. **Fix one layer at a time** — Each bug was only visible after the previous one was fixed (connect had to work before callback was reached, callback had to succeed before worker could read tokens, etc.)
5. **Verify across all services** — After fixing the main app, ran `grep` across the entire project to find the same broken pattern in the bg-worker (a separate codebase that was easy to miss)

---
---

# Bug 5: Email Subject and Body Empty When Campaign is Sent (VALIDATION_ERROR)

## Symptom

After composing an email with both subject and body in the UI, clicking "Done & Next" to finalize, and then sending the campaign, the bg-worker reported:

```
[Campaign:c1d8d765][1/1] Email body length: 0 characters
[Campaign:c1d8d765][1/1] Send result: success=false, errorCode=VALIDATION_ERROR
[Campaign:c1d8d765][1/1] ❌ Failed: VALIDATION_ERROR - Email subject cannot be empty
```

The user had written both subject and body, but the worker received empty strings for both fields.

## Root Cause: Two Bugs Working Together

### Bug 5a: Contact ID Mismatch (Primary — Data Never Saved to DB)

**The core problem:** The frontend contact IDs and the database contact IDs were completely different, so the PATCH request to save email content silently updated zero rows.

**How contact IDs flow through the system:**

```
Step 1: CSV Upload (frontend)
    ContactUploader.tsx creates contacts with crypto.randomUUID()
    → Contact gets id: "abc-random-frontend-uuid"

Step 2: Campaign Creation (POST /api/campaigns)
    Backend upserts contacts into `contacts` table
    → Contact gets database id: "xyz-real-database-uuid"
    Backend creates campaign_contacts row with:
    → campaign_contacts.contact_id = "xyz-real-database-uuid"

    ⚠️ Backend returns response but does NOT include the database contact IDs
    → Frontend still thinks contact id = "abc-random-frontend-uuid"

Step 3: Email Composition (frontend)
    User writes subject + body
    updateContactEmail("abc-random-frontend-uuid", subject, body)
    → Saved in React state under "abc-random-frontend-uuid"

Step 4: Save to Database (PATCH /api/campaigns/[id])
    Frontend sends: { contacts: [{ id: "abc-random-frontend-uuid", emailSubject: "...", emailBody: "..." }] }
    Backend runs:
        supabase.from('campaign_contacts')
            .update({ email_subject, email_body })
            .eq('campaign_id', campaignId)
            .eq('contact_id', "abc-random-frontend-uuid")  ← NO MATCH!

    ⚠️ The campaign_contacts table has contact_id = "xyz-real-database-uuid"
    ⚠️ Query matches 0 rows, update does nothing, no error thrown

Step 5: Worker Sends Campaign
    Worker reads campaign_contacts from DB
    → email_subject = "" (never updated)
    → email_body = "" (never updated)
    → VALIDATION_ERROR: Email subject cannot be empty
```

**Why it was silent:** Supabase `.update()` doesn't error when zero rows match — it just returns an empty result. The old code didn't check the row count, so it reported "Contacts saved to database" even though nothing was actually saved.

### Bug 5b: Race Condition in handleDoneAndNext (Secondary)

Even if Bug 5a hadn't existed, there was a second bug that could cause empty content:

```tsx
// compose-review-page.tsx — handleDoneAndNext()

// Line 191: Queue a React state update (ASYNC — does not apply immediately)
updateContactEmail(selectedContact.id, subject, emailBody)

// Line 203: 100ms later, call saveContactsToDatabase()
setTimeout(async () => {
    const saved = await saveContactsToDatabase()  // ← reads from campaign state
}, 100)
```

The problem: `saveContactsToDatabase` is a `useCallback` that captures the `campaign` variable from its closure. When it runs, it reads `campaign.contacts` — but the state update from `updateContactEmail` hasn't been applied yet (React batches state updates). So it reads the **old** state where `emailSubject` and `emailBody` are still empty/undefined for the last contact.

## Fix

### Fix 5a: Return database contact IDs and remap on frontend

**`app/api/campaigns/route.ts`** — POST endpoint now returns a `contactIdMap` in the response:

```ts
// Build contact ID mapping: email → database contact ID
const contactIdMap: Record<string, string> = {};
for (const [email, id] of contactEmailToIdMap.entries()) {
    contactIdMap[email] = id;
}

return NextResponse.json({
    success: true,
    campaign: {
        ...campaignData,
        contactIdMap,  // ← NEW: { "user@example.com": "xyz-real-database-uuid" }
    },
});
```

**`context/CampaignContext.tsx`** — After receiving the POST response, remaps all frontend contact IDs to database IDs:

```ts
// In saveCampaignToDatabaseInternal():
const contactIdMap = data.campaign!.contactIdMap;
setCampaign(prev => ({
    ...prev,
    id: data.campaign!.id,
    contacts: contactIdMap
        ? prev.contacts.map(c => ({
            ...c,
            id: contactIdMap[c.email] || c.id,  // ← remap to DB ID
          }))
        : prev.contacts,
}));

// Also remap currentContactId so the compose page stays in sync
if (contactIdMap && currentContactId) {
    const contact = localCampaign.contacts.find(c => c.id === currentContactId);
    if (contact && contactIdMap[contact.email]) {
        setCurrentContactId(contactIdMap[contact.email]);
    }
}
```

Now when `saveContactsToDatabase` sends the PATCH request, `contact.id` is the real database contact ID, so `.eq('contact_id', contact.id)` matches correctly.

### Fix 5b: Pass pending update directly to saveContactsToDatabase

**`context/CampaignContext.tsx`** — `saveContactsToDatabase` now accepts an optional `pendingUpdate` parameter:

```ts
const saveContactsToDatabase = async (
    pendingUpdate?: { contactId: string; subject: string; body: string }
): Promise<boolean> => {
    // Apply any pending update that hasn't been flushed to state yet
    const contactsWithPending = pendingUpdate
        ? campaign.contacts.map(c =>
            c.id === pendingUpdate.contactId
                ? { ...c, emailSubject: pendingUpdate.subject, emailBody: pendingUpdate.body }
                : c
          )
        : campaign.contacts;

    // Use contactsWithPending instead of campaign.contacts for the API call
    ...
};
```

**`compose-review-page.tsx`** — `handleDoneAndNext` passes the current contact's data directly:

```tsx
const pendingUpdate = {
    contactId: selectedContact.id,
    subject,
    body: emailBody,
}

setTimeout(async () => {
    const saved = await saveContactsToDatabase(pendingUpdate)  // ← passes data directly
}, 100)
```

### Fix 5c: Add logging to PATCH endpoint

**`app/api/campaigns/[id]/route.ts`** — The PATCH endpoint now logs whether each contact update actually matched rows:

```ts
const { error: contactUpdateError, count } = await supabase
    .from('campaign_contacts')
    .update(contactUpdateData, { count: 'exact' })
    .eq('campaign_id', campaignId)
    .eq('contact_id', contact.id);

if (count === 0) {
    console.warn(`No rows updated for contact_id=${contact.id} in campaign ${campaignId}`);
}
```

This prevents the same class of bug from going undetected in the future.

## Files Changed

| File | Change |
|------|--------|
| `app/api/campaigns/route.ts` | POST response now includes `contactIdMap` (email → database contact ID) |
| `context/CampaignContext.tsx` | Remaps frontend contact IDs to database IDs after campaign creation; `saveContactsToDatabase` accepts `pendingUpdate` param to avoid race condition |
| `components/campaigns/compose-ui/compose-review-page.tsx` | Passes current contact's subject/body as `pendingUpdate` when saving |
| `app/api/campaigns/[id]/route.ts` | Added row count checking and logging to PATCH contact updates |

## Key Takeaway

When your system creates entities in two places (frontend generates temporary IDs, backend generates real IDs), the IDs **must be synchronized back to the frontend** after creation. Otherwise, all subsequent operations that reference those IDs (updates, deletes, etc.) will silently fail — Supabase `.update()` with no matching rows returns success with zero rows affected, which is easy to miss without explicit count checking.

---

# Summary of All Bugs

| # | Bug | Where | Error | Root Cause |
|---|-----|-------|-------|------------|
| 1 | Request body consumed before reading | `connect/route.ts` | `Unexpected end of JSON input` | `getServerSession()` consumed request stream before `request.json()` |
| 2 | Non-existent column in DB payload | `callback/route.ts`, `client.ts` | `PGRST204` — column not found | Code referenced `gmail_refresh_token` which doesn't exist in schema |
| 3 | bg-worker using old token schema | `bg-worker/email-service.ts` | `42703` — column not found | Worker never migrated to encrypted 3-column token storage |
| 4 | Encryption key all zeros | `bg-worker/encryption.ts` | `unable to authenticate data` | Key read at module load time before dotenv loaded env vars |
| 5 | Email subject/body empty on send | `route.ts`, `CampaignContext.tsx` | `VALIDATION_ERROR` — subject empty | Frontend contact IDs didn't match database IDs, so PATCH updated 0 rows; plus React state race condition |
