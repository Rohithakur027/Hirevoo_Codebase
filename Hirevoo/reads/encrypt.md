# Encryption Implementation Flow (Salt-based IV)

This document explains the implemented security architecture for storing Gmail Refresh Tokens using **AES-256-GCM**, specifically detailing the naming convention where the cryptographic Initialization Vector (IV) is stored as `salt` in the database.

## Technical decision: "Salt" vs "IV"
In cryptography, an **IV** (Initialization Vector) adds randomness to the encryption so that the same data encrypted twice produces different outputs. In our database schema, we have named this column `gmail_refresh_token_salt` to make its purpose (adding randomness) intuitive, even though technically it serves as the IV for the AES-GCM algorithm.

**Mapping:**
- **Database Column**: `gmail_refresh_token_salt`
- **Crypto Parameter**: `iv` (Initialization Vector)

## Architecture

### 1. Security Configuration
- **Algorithm**: `aes-256-gcm` (Authenticated Encryption)
- **Key**: stored in `process.env.ENCRYPTION_KEY` (32-byte hex string)

### 2. Database Schema
The `users` table uses three columns to store the encrypted token:

| Column Name | Crypto Component | Description |
|---|---|---|
| `gmail_refresh_token_salt` | **IV** (16 bytes) | The random value ensuring unique encryption. |
| `gmail_refresh_token_content` | **Ciphertext** | The actual encrypted token string. |
| `gmail_refresh_token_tag` | **Auth Tag** (16 bytes) | Ensures the data hasn't been tampered with. |

### 3. The Encryption Flow (Write)
**Location**: `app/api/auth/gmail/callback/route.ts`

When a user connects their Gmail account:
1.  **Input**: Receive plain text `refresh_token` from Google.
2.  **Encrypt**: Call `encrypt(token)` helper.
    -   Generates 16 random bytes (**IV**).
    -   Encrypts the token using the Key and IV.
    -   Generates an Auth Tag.
3.  **Output**: Returns an object `{ salt, content, tag }`.
4.  **Save**:
    -   `gmail_refresh_token_salt` = `salt` (the IV)
    -   `gmail_refresh_token_content` = `content`
    -   `gmail_refresh_token_tag` = `tag`
    -   (Old `gmail_refresh_token` column is set to NULL).

### 4. The Decryption Flow (Read)
**Location**: `lib/gmail/client.ts` & `app/api/webhooks/gmail/route.ts`

When the background worker needs to sync emails:
1.  **Fetch**: SELECT `salt`, `content`, `tag` columns from `users`.
2.  **Decrypt**: Call `decrypt({ salt, content, tag })` helper.
    -   Takes the `salt` from the DB and passes it as the **IV** to the decipher.
    -   Sets the Auth Tag to verify integrity.
    -   Decrypts and returns the original string.
3.  **Use**: authenticate with `google.auth.OAuth2`.

## Helper Utility (`lib/encryption.ts`)

```typescript
// Simplified view of the implemented logic
export function encrypt(text: string) {
    const iv = crypto.randomBytes(16); // The "Salt"
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    // ... encryption logic ...
    return {
        salt: iv.toString('hex'), // Return IV as 'salt'
        content: encrypted,
        tag: authTag
    };
}

export function decrypt(data: { salt: string, content: string, tag: string }) {
    const iv = Buffer.from(data.salt, 'hex'); // Map 'salt' back to IV
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    // ... decryption logic ...
    return decryptedString;
}
```
