# Database & Backend Changes Log

Two sets of changes were made: (1) timestamps migrated from IST to UTC, (2) email body storage changed from HTML to plain text, and (3) the EmailChatDialog was wired to real database data.

---

## 1. Timestamps: IST to UTC

### Problem
All timestamps were stored in Indian Standard Time (+05:30) using a custom `getIndianTimeISO()` function that manually computed IST offset and appended `+05:30` to the ISO string. This is not portable and causes issues when the app is used from other timezones or when doing date math.

### Change
Renamed `getIndianTimeISO()` to `getUTCTimeISO()` in `lib/date-helpers.ts`. The new function simply returns `new Date().toISOString()` which produces a standard UTC timestamp ending in `Z`.

### Files Changed
| File | What changed |
|------|-------------|
| `lib/date-helpers.ts` | `getIndianTimeISO()` replaced with `getUTCTimeISO()` |
| `app/api/campaigns/route.ts` | Import + all calls updated |
| `app/api/campaigns/[id]/route.ts` | Import + all calls updated |
| `app/api/campaigns/[id]/send/route.ts` | Import + all calls updated |
| `app/api/campaigns/[id]/reset/route.ts` | Import + all calls updated |
| `app/api/auth/gmail/callback/route.ts` | Import + all calls updated |
| `app/api/auth/gmail/disconnect/route.ts` | Import + all calls updated |
| `app/api/campaign/send/route.ts` | Import + all calls updated |
| `app/api/webhooks/gmail/route.ts` | Import + all calls updated |
| `lib/gmail/client.ts` | Import + all calls updated |

### Database Impact
All `created_at`, `updated_at`, `sent_at`, `replied_at` values are now stored as UTC (`2026-01-27T10:30:00.000Z`) instead of IST (`2026-01-27T16:00:00.000+05:30`). Existing IST data in the database is still valid ISO 8601 and will parse correctly, but new records will be UTC.

---

## 2. Email Body: HTML to Plain Text

### Problem
The email body composed in the Tiptap editor was stored as raw HTML in the database (`campaign_contacts.email_body` and `campaign_emails.email_body`). This is unnecessary storage overhead since we only need the text content. HTML formatting is only needed at send time.

### Change
- The Tiptap editor now calls `editor.getText()` instead of `editor.getHTML()` when saving
- The database stores plain text
- A `plainTextToHtml()` function converts plain text back to HTML at send time (escapes entities, converts `\n` to `<br>`, wraps in a styled `<div>`)
- Gmail still receives properly formatted HTML emails

### Files Changed
| File | What changed |
|------|-------------|
| `components/campaigns/compose-ui/email-editor.tsx` | `onUpdate` saves `editor.getText()` instead of `editor.getHTML()`. Sync comparison also uses `getText()`. |
| `components/campaigns/compose-ui/compose-review-page.tsx` | Default email body changed from HTML (`<p>Hi...</p>`) to plain text (`Hi...\n\n...`) |
| `bg-worker/workers/jobs/send-campaign.ts` | Added `plainTextToHtml()` helper. Both `processCampaign` and `processCampaignInBatches` convert plain text to HTML before calling `sendEmail()`. `campaign_emails` insert still stores plain text. |
| `app/api/campaign/send/route.ts` | Added `plainTextToHtml()` helper. Converts plain text to HTML before sending via `gmailClient.sendEmail()`. |

### plainTextToHtml() Logic
```typescript
function plainTextToHtml(text: string): string {
  // 1. Escape HTML entities (&, <, >, ")
  // 2. Convert \n to <br>
  // 3. Wrap in <div> with font-family, font-size, line-height, color
}
```

### Database Impact
- `campaign_contacts.email_body` now stores plain text instead of HTML
- `campaign_emails.email_body` now stores plain text instead of HTML
- Existing HTML data in the DB will still render in the chat dialog (it shows `msg.content` in a `<p>` with `whitespace-pre-wrap`)

---

## 3. EmailChatDialog: Mock Data to Real Database

### Problem
The EmailChatDialog component was using hardcoded mock conversation data from `lib/data.ts` via a fake API route.

### Architecture
Uses a "Split Table" approach to avoid data duplication:
- **`campaign_contacts`** table stores the initial outbound email (`email_body`, `sent_at`)
- **`chat_messages`** table stores all subsequent replies (inbound from contact) and follow-ups (outbound from user)

### Changes Made

#### API Route (`app/api/emails/conversation/route.ts`) - Full Rewrite
- Accepts `?campaignContactId=<uuid>` query parameter
- Authenticates the user via session
- Verifies campaign ownership via `campaigns.user_id`
- **Query 1**: Fetches initial outbound email from `campaign_contacts` (email_body + sent_at + status)
- **Query 2**: Fetches all chat messages from `chat_messages` (body_text, direction, created_at)
- Merges both into a unified `Message[]` array
- Sorts chronologically (oldest first)
- Maps `direction` to `from: 'user' | 'recipient'`
- Maps `campaign_contacts.status` to message status (`sent`, `read`, `failed`)

#### Data Flow
```
RecipientTable (click "View" eye icon)
  -> EmailChatDialog opens
    -> GET /api/emails/conversation?campaignContactId=<uuid>
      -> Query campaign_contacts (initial outbound)
      -> Query chat_messages (all replies & follow-ups)
      -> Merge + sort chronologically
    -> Returns Message[] to frontend
    -> Renders as chat bubbles (outbound=right/black, inbound=left/white)
```

#### Files Changed
| File | What changed |
|------|-------------|
| `lib/data.ts` | Added `campaignContactId?: string` to `Recipient` interface. Removed mock `getEmailConversation()` function. |
| `app/api/campaigns/[id]/route.ts` | Added `campaignContactId: c.id` to GET response so frontend knows the `campaign_contacts` primary key. |
| `app/campaigns/[campaignId]/page.tsx` | Passes `campaignContactId` when mapping contacts to `Recipient` objects. |
| `app/api/emails/conversation/route.ts` | Full rewrite: mock data replaced with Supabase queries against `campaign_contacts` + `chat_messages`. |
| `components/dashboard/EmailChatDialog.tsx` | Fetches using `campaignContactId` instead of `recipientId`. Falls back to `recipient.id` for backward compatibility. |

### Database Tables Used
```
campaign_contacts (Parent - initial blast)
├── id (uuid, PK) ← this is the campaignContactId
├── email_body (text, plain text)
├── sent_at (timestamptz)
├── status (text)
├── campaign_id (uuid, FK → campaigns)
└── contact_id (uuid, FK → contacts)

chat_messages (Child - conversation thread)
├── id (uuid, PK)
├── campaign_contact_id (uuid, FK → campaign_contacts.id)
├── body_text (text, plain text)
├── direction (text: 'inbound' | 'outbound')
└── created_at (timestamptz)
```
