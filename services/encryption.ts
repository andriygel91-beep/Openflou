// Openflou Encryption Service - End-to-End Encryption (Demo)
import CryptoJS from 'crypto-js';

// Note: This is a simplified demo encryption for V1.0
// Production should use proper E2E encryption libraries

const ENCRYPTION_KEY = 'openflou_secure_key_v1'; // In production, use per-chat keys

export function encryptMessage(plaintext: string): string {
  try {
    const encrypted = CryptoJS.AES.encrypt(plaintext, ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption failed:', error);
    return plaintext;
  }
}

export function decryptMessage(ciphertext: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || ciphertext;
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
  return `chat_${CryptoJS.MD5(sorted).toString()}`;
}

// Generate unique user ID
export function generateUserId(username: string): string {
  return `user_${CryptoJS.MD5(username.toLowerCase()).toString()}`;
}
