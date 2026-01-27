import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Get encryption key lazily at call time, not at module load time.
 * This ensures dotenv has loaded .env.local before we read the key.
 */
function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is not set. Cannot decrypt tokens.');
    }
    return Buffer.from(key, 'hex');
}

export function decrypt(data: { salt: string, content: string, tag: string }): string {
    const { salt, content, tag } = data;

    const encryptionKey = getEncryptionKey();
    const iv = Buffer.from(salt, 'hex');
    const authTag = Buffer.from(tag, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
