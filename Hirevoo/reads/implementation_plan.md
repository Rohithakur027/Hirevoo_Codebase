# Gmail Webhook Implementation Plan

I will implement the `triggerHistorySync` function in `app/api/webhooks/gmail/route.ts` to handle Gmail history updates, sync messages to the database, and update campaign contact statuses.

## User Review Required

> [!NOTE]
> **Encryption**: The codebase currently uses plain text for tokens. I will use a pass-through `decrypt` function to satisfy the prompt's structure while matching the actual codebase behavior.

## Proposed Changes

### Backend Logic

#### [MODIFY] [route.ts](file:///d:/001GOAT/projects/01-email/Hirevoo/app/api/webhooks/gmail/route.ts)

- Implement `triggerHistorySync` function:
    1.  **Token Retrieval**: Query `users` table for `gmail_refresh_token` (plain text).
    2.  **Auth**: Initialize `google.auth.OAuth2` with the refreshed token.
    3.  **Fetch History**: Call `gmail.users.history.list` with `historyId`.
    4.  **Fetch Messages**: Call `gmail.users.messages.get` for new messages (`messagesAdded`).
    5.  **Sanitize**:
        - Extract body (text/plain or strip HTML).
        - Detect rich content (`<img>`, `<table>`, attachments).
        - Determine direction (inbound/outbound) by comparing `From` header.
    6.  **DB Writes**:
        - **Find Contact**: Match message `threadId` to `campaign_contacts.gmail_thread_id`.
        - **Insert Message**: Insert into `chat_messages`:
            - `campaign_contact_id` (from match)
            - `gmail_message_id`
            - `direction`
            - `body_text`
            - `has_rich_content`
        - **Update Status**: If inbound, set `campaign_contacts.status = 'replied'`, `replied_at = NOW()`.

## Verification Plan

### Manual Verification
1.  **Mock Webhook Call**: Send a POST request to `/api/webhooks/gmail` with a valid payload.
2.  **Log Verification**: Check server logs for success messages.
3.  **DB Verification**: Check `campaign_contacts` and `chat_messages` for updates.
