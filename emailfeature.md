# Email Campaign Feature - Full Documentation

## Overview

The email campaign system allows users to compose personalized emails for multiple contacts, save them per-contact, and send them in bulk through their connected Gmail account. Each contact gets their own individually crafted email with personalized content.

---

## How It Works - End-to-End Flow

### Step 1: Campaign Creation (CSV Upload)

- User uploads a CSV file with contact data (name, email, company, role)
- Frontend creates a campaign in local state with a temporary ID (`temp-XXXXX`)
- `CampaignContext.createCampaign()` stores contacts in React state
- In the background, `POST /api/campaigns` is called to persist the campaign to the database
- The temporary ID is replaced with the real database UUID once saved

### Step 2: Email Composition (`/campaigns/[campaignId]/compose`)

- The compose page shows a 3-column layout:
  - **Left**: Contact sidebar listing all contacts with status indicators
  - **Right**: Rich text email editor (Tiptap) for composing per-contact emails
- Each contact has their own individual **subject** and **email body**
- When switching between contacts, the editor loads that contact's saved email content
- If a contact has no saved email yet, a personalized default is generated using their first name
- Users can use the **Variables** button to insert the contact's first name into the email
- Users can also use **AI Assistant** or **Browse Templates** to generate content
- Clicking **Done & Next** saves the current contact's email to the campaign context and moves to the next contact

### Step 3: Save to Database

- When all contacts are marked as "done", `saveContactsToDatabase()` is called
- This sends a `PATCH /api/campaigns/[id]` request with each contact's personalized `emailSubject` and `emailBody`
- The API updates the `campaign_contacts` table with the per-contact email content
- User is then redirected to the send page

### Step 4: Campaign Sending (`/campaigns/[campaignId]/send`)

- The send page auto-triggers `POST /api/campaigns/[id]/send`
- This endpoint:
  1. Authenticates the user
  2. Validates Gmail is connected
  3. Checks daily sending limits (free: 10, pro: 25, promax: 50)
  4. Counts pending emails
  5. Queues a job to the background worker via `POST {BG_WORKER_URL}/api/campaigns/[id]/send`
  6. Updates campaign status to `'sending'`

### Step 5: Background Worker Processing

- BullMQ picks up the job and runs `processCampaign()`
- For each pending email in `campaign_contacts`:
  1. Fetches the contact's email, name, subject, and body from the database
  2. **Replaces template variables** (`{FirstName}`, `{FullName}`, `{Name}`, `{Email}`) with actual contact data
  3. Sends via Gmail API using the user's OAuth tokens
  4. Updates `campaign_contacts` status to `'sent'` or `'failed'`
  5. Publishes real-time progress events via Redis Pub/Sub
- Rate limits at 200ms between emails to stay under Gmail's ~5 emails/second limit

### Step 6: Real-Time Progress

- The send page uses Socket.IO (`useCampaignProgress()` hook) to listen for:
  - `email:sent` - updates individual contact status and progress bar
  - `email:failed` - shows error details for failed emails
  - `campaign:complete` - shows final summary with sent/failed counts

---

## What Data is Sent Over Email

Each email sent to a contact contains:

| Field | Source | Description |
|-------|--------|-------------|
| **From** | Gmail API profile | The user's connected Gmail address |
| **To** | `contacts.email` | The recipient's email from CSV upload |
| **To Name** | `contacts.name` | The recipient's display name (optional) |
| **Subject** | `campaign_contacts.email_subject` | Per-contact subject composed by user |
| **Body** | `campaign_contacts.email_body` | Per-contact HTML body composed by user |
| **Content-Type** | Hardcoded | `text/html; charset=utf-8` |
| **MIME-Version** | Hardcoded | `1.0` |

The email is formatted as RFC 2822, base64url-encoded, and sent via `gmail.users.messages.send()`.

### Variable Replacement

Before sending, the background worker replaces these template variables with real contact data:

| Variable | Replaced With | Example |
|----------|---------------|---------|
| `{FirstName}` | First word of contact's name | "John" |
| `{FullName}` | Full contact name | "John Smith" |
| `{Name}` | Full contact name (alias) | "John Smith" |
| `{Email}` | Contact's email address | "john@example.com" |

---

## Routes Involved

### Frontend Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/campaigns/[campaignId]/compose` | `ComposeReviewPage` | Email composition per-contact |
| `/campaigns/[campaignId]/send` | `SendCampaignPage` | Campaign sending with progress |

### API Routes (Next.js)

| Route | Method | File | Purpose |
|-------|--------|------|---------|
| `/api/campaigns` | POST | `app/api/campaigns/route.ts` | Create campaign + contacts in DB |
| `/api/campaigns` | GET | `app/api/campaigns/route.ts` | List user's campaigns |
| `/api/campaigns/[id]` | GET | `app/api/campaigns/[id]/route.ts` | Get single campaign with contacts |
| `/api/campaigns/[id]` | PATCH | `app/api/campaigns/[id]/route.ts` | Update campaign name/status and per-contact email content |
| `/api/campaigns/[id]` | DELETE | `app/api/campaigns/[id]/route.ts` | Delete campaign and contacts |
| `/api/campaigns/[id]/send` | POST | `app/api/campaigns/[id]/send/route.ts` | Validate and queue campaign for sending |
| `/api/campaigns/[id]/reset` | POST | `app/api/campaigns/[id]/reset/route.ts` | Reset stuck campaign |
| `/api/auth/gmail/connect` | GET | `app/api/auth/gmail/connect/route.ts` | Start Gmail OAuth flow |
| `/api/auth/gmail/callback` | GET | `app/api/auth/gmail/callback/route.ts` | Handle Gmail OAuth callback |
| `/api/auth/gmail/status` | GET | `app/api/auth/gmail/status/route.ts` | Check Gmail connection status |
| `/api/auth/gmail/disconnect` | POST | `app/api/auth/gmail/disconnect/route.ts` | Disconnect Gmail |

### Background Worker Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `{BG_WORKER_URL}/api/campaigns/[id]/send` | POST | Queue campaign send job |
| `{BG_WORKER_URL}/api/campaigns/[id]/send` | GET | Check job status |

---

## Database Tables

### `campaigns`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to users |
| name | text | Campaign name |
| status | text | draft, composing, ready, sending, sent |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |
| sent_at | timestamp | When campaign was fully sent |

### `contacts`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to users |
| email | text | Contact email (unique per user) |
| name | text | Contact full name |
| company | text | Company name (optional) |
| role | text | Job role (optional) |

### `campaign_contacts` (join table with per-contact email content)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| campaign_id | uuid | Foreign key to campaigns |
| contact_id | uuid | Foreign key to contacts |
| email_subject | text | Personalized email subject for this contact |
| email_body | text | Personalized email body (HTML) for this contact |
| status | text | pending, sent, failed |
| sent_at | timestamp | When this email was sent |
| error_message | text | Error details if failed |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

---

## Key Components

### Frontend

| File | Purpose |
|------|---------|
| `context/CampaignContext.tsx` | Global campaign state management (contacts, email content, save/load) |
| `components/campaigns/compose-ui/compose-review-page.tsx` | Main compose page - contact list + email editor |
| `components/campaigns/compose-ui/email-editor.tsx` | Rich text editor (Tiptap) with toolbar, variables, templates |
| `components/campaigns/compose-ui/contact-sidebar.tsx` | Contact list with search and status indicators |
| `components/campaigns/compose-ui/send-campaign-page.tsx` | Send progress page with real-time updates |

### Backend

| File | Purpose |
|------|---------|
| `bg-worker/workers/jobs/send-campaign.ts` | Core campaign processing logic (fetch, send, update, publish events) |
| `bg-worker/lib/services/email-service.ts` | Gmail API wrapper (OAuth, compose RFC 2822, send, error handling) |
| `bg-worker/lib/encryption.ts` | Token encryption/decryption for stored refresh tokens |

---

## Implementation Details

### How Per-Contact Emails Work

1. **Compose Page**: When the user selects a contact, the editor loads that contact's saved `emailSubject` and `emailBody` from the CampaignContext. If no saved content exists, a personalized default using the contact's first name is generated.

2. **Saving**: When the user clicks "Done & Next", `updateContactEmail(contactId, subject, body)` saves the content to the CampaignContext state. When switching contacts, the current contact's content is also auto-saved.

3. **Database Persistence**: When all contacts are done, `saveContactsToDatabase()` calls `PATCH /api/campaigns/[id]` with an array of `{ id, emailSubject, emailBody }` for each contact. The API updates each `campaign_contacts` row individually.

4. **Sending**: The background worker reads `email_subject` and `email_body` from `campaign_contacts`, replaces template variables with real contact data, and sends via Gmail API.

### Gmail OAuth Flow

1. User clicks "Connect Gmail" which redirects to `/api/auth/gmail/connect`
2. Google OAuth consent screen is shown requesting `gmail.send` and `gmail.readonly` scopes
3. After approval, Google redirects to `/api/auth/gmail/callback`
4. The callback encrypts the refresh token and stores it in the `users` table
5. When sending, the worker decrypts the refresh token, exchanges it for an access token, and uses it to call the Gmail API

### Token Security

- Refresh tokens are encrypted using AES-256-GCM before storage
- Three columns store the encrypted token: `gmail_refresh_token_IV`, `gmail_refresh_token_content`, `gmail_refresh_token_tag`
- Access tokens are never stored - obtained fresh by refreshing on each use
- If a refresh token becomes invalid (`invalid_grant`), `gmail_connected` is set to `false`

### Error Handling

- Individual email failures do not stop the campaign
- Errors are categorized: `INVALID_RECIPIENT`, `TOKEN_EXPIRED`, `RATE_LIMITED`, `QUOTA_EXCEEDED`, `NETWORK_ERROR`, etc.
- Stuck campaigns (in 'sending' state for >30 minutes) are auto-recovered
- Failed emails have their error message stored in `campaign_contacts.error_message`

### Rate Limiting

- 200ms delay between emails (stays under Gmail's ~5/second limit)
- Daily sending limits enforced per user plan
- Job progress updates batched every 10 emails
- Pub/Sub events batched every 5 emails
