# Email Chat Box Implementation & Best Practices

This document explains the technical flow of the Email Chat Box feature and outlines best practices for scaling and database management.

## 1. Technical Flow

### 1.1 User Interaction
1.  **Trigger**: User clicks the "Eye" (View) icon on a contact in the `RecipientTable`.
2.  **State Change**: `EmailChatDialog` opens, receiving the `recipient` object as a prop.
3.  **Data Fetching**:
    -   Using `useEffect`, the component triggers a fetch request to `/api/emails/conversation?recipientId=...`.
    -   While fetching, a loading spinner (Clock/Loader) is displayed.

### 1.2 Backend Processing
1.  **API Route** (`app/api/emails/conversation/route.ts`):
    -   Receives the `GET` request.
    -   Extracts `recipientId` from query parameters.
    -   **Queries Database**: Fetches all `Message` records associated with this recipient ID (and current user context).
    -   **Sorts Data**: Ensures messages are ordered chronologically by timestamp.
    -   **Returns JSON**: Sends the array of messages back to the client.

### 1.3 UI Rendering
1.  **Chat Interface**:
    -   The `EmailChatDialog` maps through the `messages`.
    -   **Sent Messages (User)**: Aligned to the **right** with a green/light-green background (`#d9fdd3`).
    -   **Received Messages (Recipient)**: Aligned to the **left** with a white background.
2.  **Status Indicators (WhatsApp Style)**:
    -   Each sent message checks its `status` field:
    -   🕒 **Clock**: Pending (sending in progress).
    -   ✓ **One Gray Tick**: Sent to server.
    -   ✓✓ **Two Gray Ticks**: Delivered to recipient's inbox.
    -   ✓✓ **Two Blue Ticks**: Read/Opened by recipient.

## 2. Best Practices for Scaling

### 2.1 Database Design
To handle millions of emails efficiently:

-   **Indexing**:
    -   Create composite indexes on `[recipientId, timestamp]` for fast retrieval of conversation history.
    -   Index `status` for quick filtering of unread messages.
-   **Sharding**:
    -   For massive scale, shard the `Messages` table by `userId` or `recipientId` to distribute load.
-   **Archiving**:
    -   Move old emails (e.g., > 1 year) to "Cold Storage" (e.g., S3/Glacier or a separate archive table) to keep the active table light and fast.

### 2.2 API & Caching
-   **Pagination**:
    -   Do **not** fetch the entire history at once. Implement cursor-based pagination (e.g., `limit=20`, `beforeTimestamp=...`) to load messages as the user scrolls up.
-   **Redis Caching**:
    -   Cache the "latest conversation view" in Redis. Invalidate/Update cache only when a new message arrives.
    -   This reduces load on the primary database for frequent viewings.

### 2.3 Real-Time Updates (Sockets)
-   **WebSockets (Socket.io / Pusher)**:
    -   Instead of polling, establish a WebSocket connection.
    -   Push a "New Message" event or "Status Update" (Read Receipt) event instantly to the client to update the UI (turn gray ticks blue) without refreshing.

### 2.4 Security
-   **Validation**: Ensure the requesting user actually owns the conversation with the `recipientId`.
-   **Sanitization**: Sanitize email HTML content before rendering to prevent XSS (Cross-Site Scripting), although we are currently displaying text content safely.

---
**Current Implementation Status**:
-   The frontend UI is built with Tailwind CSS matching the "WhatsApp" aesthetic.
-   The mock API simulates network delay and fetches sample conversation data.
-   Status ticks logic is implemented.
