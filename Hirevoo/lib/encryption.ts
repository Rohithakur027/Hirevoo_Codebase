import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// 32-byte key from environment variable
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
    ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
    : Buffer.alloc(32); // Fallback for build time, should fail in runtime if missing

if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV !== 'production') {
    console.warn('WARNING: ENCRYPTION_KEY is missing. Encryption will fail.');
}

/**
 * Encrypts text using AES-256-GCM.
 * Generates a random "salt" (IV) and returns it along with content and auth tag.
 */
export function encrypt(text: string): { salt: string, content: string, tag: string } {
    // Generate 16 bytes for IV (mapped to 'salt' in DB)
    const iv = crypto.randomBytes(16);

    // Create cipher using key and IV
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return {
        salt: iv.toString('hex'), // IV is stored as 'salt'
        content: encrypted,
        tag: authTag
    };
}

/**
 * Decrypts data using AES-256-GCM.
 * Expects 'salt' to be passed as the IV.
 */
export function decrypt(data: { salt: string, content: string, tag: string }): string {
    const { salt, content, tag } = data;

    // Convert hex strings back to buffers
    const iv = Buffer.from(salt, 'hex'); // 'salt' is the IV
    const authTag = Buffer.from(tag, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
