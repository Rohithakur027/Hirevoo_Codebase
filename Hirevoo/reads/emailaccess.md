# Gmail Webhook Implementation Explanation

I have successfully implemented the `triggerHistorySync` function in `app/api/webhooks/gmail/route.ts`. 

## Implementation Details

### 1. Token Handling & Encryption
**Approach**: I adapted the logic to match your existing codebase.
- **Observation**: Your `GmailClient` and `auth/callback` logic currently handle `gmail_refresh_token` as plain text. The requested `lib/encryption.ts` file does not exist.
- **Decision**: To avoid breaking changes or "inventing" a new encryption scheme that isn't supported by the rest of your app, I implemented a pass-through `decrypt` function.
  ```typescript
  // Pass-through decryption since codebase uses plain text
  function decrypt(token: string): string {
      return token;
  }
  ```
- **Future Recommendation**: Once you implement encryption in `lib/encryption.ts`, you can update this single function to use it.

### 2. Database Schema
**Approach**: Based on your prompt and the confirmed schema structure:
- **`chat_messages`**: I used the exact columns requested:
    - `campaign_contact_id`: Links the message to the specific campaign contact.
    - `gmail_message_id`: Unique ID from Gmail to prevent duplicates.
    - `direction`: 'inbound' or 'outbound'.
    - `body_text`: Sanitized plain text content.
    - `has_rich_content`: Boolean flag for HTML/attachments.
- **`campaign_contacts`**: Used for tracking thread status (`replied`, `replied_at`).

### 3. Logic Flow
1.  **Context**: The webhook receives `historyId` and `email`.
2.  **Fetching**: We use the `historyId` to get a list of *changed* messages (`messagesAdded`).
3.  **Details**: We fetch the full message payload to extract headers (for thread ID and sender) and body.
4.  **Threading Logic**:
    - **Primary Match**: We try to find the `campaign_contact` using `gmail_thread_id`.
    - **Fallback Match**: If the thread ID isn't found (e.g., first reply), we search for the contact by `email` and link them to the most recent active campaign. We then backfill the `gmail_thread_id` to ensure future threaded messages match correctly.
5.  **Sanitization**: We favor `text/plain` parts. If only `text/html` is available, we strip tags to populate `body_text` while detecting rich content (images/tables).

## Verification Checks

To verify this implementation is working:

1.  **Logs**: Watch the server console for:
    - `[Background Job] Starting sync for...`
    - `[triggerHistorySync] Processing Msg ID: ...`
    - `[triggerHistorySync] Saved chat message...`
2.  **Database**:
    - Check `chat_messages` for new rows after a reply.
    - Check `campaign_contacts` to see `status` change to `'replied'`.

## Next Steps
- Consider implementing real encryption using `crypto` in Node.js for the refresh tokens if security is a concern.
- Ensure the `chat_messages` table exists in your Supabase database with the columns used in the code.
