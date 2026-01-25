# Task: Implement Gmail Webhook triggerHistorySync

- [x] Analyze codebase for context <!-- id: 0 -->
    - [x] Check `lib/encryption.ts` or equivalent for decryption function signature <!-- id: 1 -->
    - [x] Check `lib/supabase.ts` for Admin client initialization <!-- id: 2 -->
    - [x] Check Database Schema / Types (`users`, `chat_messages`, `campaign_contacts`) <!-- id: 3 -->
- [x] Create Implementation Plan <!-- id: 4 -->
- [x] Implement `triggerHistorySync` in `app/api/webhooks/gmail/route.ts` <!-- id: 5 -->
    - [x] Secure Token Retrieval <!-- id: 6 -->
    - [x] Google Authentication <!-- id: 7 -->
    - [x] Fetching Data (`history.list`, `messages.get`) <!-- id: 8 -->
    - [x] Sanitization & Parsing <!-- id: 9 -->
    - [x] Database Writes <!-- id: 10 -->
- [ ] Verify Implementation <!-- id: 11 -->
    - [ ] Manual Check (Server Logs/DB) <!-- id: 12 -->
