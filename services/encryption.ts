// Openflou Encryption Service - End-to-End Encryption (Demo)
// Note: This is a simplified demo encryption for V1.0
// Production should use proper E2E encryption libraries

const ENCRYPTION_KEY = 'openflou_secure_key_v1';

// Simple hash function for ID generation
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Simple base64 encode/decode
function base64Encode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64');
}

function base64Decode(str: string): string {
  return Buffer.from(str, 'base64').toString('utf-8');
}

export function encryptMessage(plaintext: string): string {
  try {
    // Simple XOR encryption for demo purposes
    let encrypted = '';
    for (let i = 0; i < plaintext.length; i++) {
      const keyChar = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      const textChar = plaintext.charCodeAt(i);
      encrypted += String.fromCharCode(textChar ^ keyChar);
    }
    return base64Encode(encrypted);
  } catch (error) {
    console.error('Encryption failed:', error);
    return plaintext;
  }
}

export function decryptMessage(ciphertext: string): string {
  try {
    const decoded = base64Decode(ciphertext);
    let decrypted = '';
    for (let i = 0; i < decoded.length; i++) {
      const keyChar = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      const textChar = decoded.charCodeAt(i);
      decrypted += String.fromCharCode(textChar ^ keyChar);
    }
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return ciphertext;
  }
}

// Generate unique message ID
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate unique chat ID
export function generateChatId(participants: string[]): string {
  const sorted = [...participants].sort().join('_');
  const hash = simpleHash(sorted);
  return `chat_${hash}`;
}

// Generate unique user ID
export function generateUserId(username: string): string {
  const hash = simpleHash(username.toLowerCase());
  return `user_${hash}`;
}
