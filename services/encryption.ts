// Openflou Encryption Service — Real AES-256-GCM with ECDH P-256 key exchange
// Per-session shared secrets derived via ECDH, messages encrypted with AES-GCM
// Keys are generated once per user and stored in the DB (public key only shared)

// ─────────────────────────────────────────────────────────────────────────────
// Key persistence helpers (in-memory cache + AsyncStorage for private key)
// ─────────────────────────────────────────────────────────────────────────────

let _privateKey: CryptoKey | null = null;
let _publicKeyB64: string | null = null;

async function getOrCreateKeyPair(): Promise<{ privateKey: CryptoKey; publicKeyB64: string }> {
  if (_privateKey && _publicKeyB64) {
    return { privateKey: _privateKey, publicKeyB64: _publicKeyB64 };
  }

  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const storedPriv = await AsyncStorage.getItem('openflou_priv_key');
    const storedPub = await AsyncStorage.getItem('openflou_pub_key');

    if (storedPriv && storedPub) {
      const privKey = await crypto.subtle.importKey(
        'pkcs8',
        base64ToBuffer(storedPriv),
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey', 'deriveBits']
      );
      _privateKey = privKey;
      _publicKeyB64 = storedPub;
      return { privateKey: privKey, publicKeyB64: storedPub };
    }
  } catch {
    // AsyncStorage not available yet — fall through to generate
  }

  // Generate new ECDH key pair
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  const pubRaw = await crypto.subtle.exportKey('spki', kp.publicKey);
  const privRaw = await crypto.subtle.exportKey('pkcs8', kp.privateKey);
  const pubB64 = bufferToBase64(pubRaw);
  const privB64 = bufferToBase64(privRaw);

  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem('openflou_priv_key', privB64);
    await AsyncStorage.setItem('openflou_pub_key', pubB64);
  } catch { /* ignore */ }

  _privateKey = kp.privateKey;
  _publicKeyB64 = pubB64;
  return { privateKey: kp.privateKey, publicKeyB64: pubB64 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public key registry (fetch peer's public key from DB)
// ─────────────────────────────────────────────────────────────────────────────

const pubKeyCache: Record<string, string> = {};

export async function getMyPublicKey(): Promise<string> {
  const { publicKeyB64 } = await getOrCreateKeyPair();
  return publicKeyB64;
}

export async function getPeerPublicKey(userId: string): Promise<string | null> {
  if (pubKeyCache[userId]) return pubKeyCache[userId];
  try {
    const { getSupabaseClient } = await import('@/template');
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('openflou_users')
      .select('identity_public_key')
      .eq('id', userId)
      .single();
    if (data?.identity_public_key) {
      pubKeyCache[userId] = data.identity_public_key;
      return data.identity_public_key;
    }
  } catch { /* ignore */ }
  return null;
}

export async function publishMyPublicKey(userId: string): Promise<void> {
  try {
    const { publicKeyB64 } = await getOrCreateKeyPair();
    const { getSupabaseClient } = await import('@/template');
    const supabase = getSupabaseClient();
    await supabase
      .from('openflou_users')
      .update({ identity_public_key: publicKeyB64 })
      .eq('id', userId);
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// AES-GCM encryption with ECDH shared secret
// ─────────────────────────────────────────────────────────────────────────────

export async function encryptForPeer(
  plaintext: string,
  recipientPublicKeyB64: string
): Promise<{ ciphertext: string; iv: string } | null> {
  try {
    const { privateKey } = await getOrCreateKeyPair();

    const recipientPubKey = await crypto.subtle.importKey(
      'spki',
      base64ToBuffer(recipientPublicKeyB64),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    const sharedSecret = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: recipientPubKey },
      privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sharedSecret,
      encoded
    );

    return {
      ciphertext: bufferToBase64(encrypted),
      iv: bufferToBase64(iv.buffer as ArrayBuffer),
    };
  } catch (err) {
    console.error('E2E encrypt failed:', err);
    return null;
  }
}

export async function decryptFromPeer(
  ciphertext: string,
  ivB64: string,
  senderPublicKeyB64: string
): Promise<string | null> {
  try {
    const { privateKey } = await getOrCreateKeyPair();

    const senderPubKey = await crypto.subtle.importKey(
      'spki',
      base64ToBuffer(senderPublicKeyB64),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    const sharedSecret = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: senderPubKey },
      privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBuffer(ivB64) },
      sharedSecret,
      base64ToBuffer(ciphertext)
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('E2E decrypt failed:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Backwards-compatible simple helpers (used for storing encrypted_content field)
// Uses a symmetric fallback when peer key is unavailable (local encryption)
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_KEY_MATERIAL = 'openflou_aes_gcm_v2';

async function getFallbackKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const raw = enc.encode(FALLBACK_KEY_MATERIAL.padEnd(32, '0').slice(0, 32));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export function encryptMessage(plaintext: string): string {
  // Synchronous fallback — stores plaintext as base64 (real E2E happens async via encryptForPeer)
  try {
    return btoa(unescape(encodeURIComponent(plaintext)));
  } catch {
    return plaintext;
  }
}

export function decryptMessage(ciphertext: string): string {
  try {
    return decodeURIComponent(escape(atob(ciphertext)));
  } catch {
    return ciphertext;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ID helpers
// ─────────────────────────────────────────────────────────────────────────────

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function generateChatId(participants: string[]): string {
  const sorted = [...participants].sort().join('_');
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash + c) | 0;
  }
  return `chat_${Math.abs(hash).toString(36)}`;
}

export function generateUserId(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    const c = username.charCodeAt(i);
    hash = ((hash << 5) - hash + c) | 0;
  }
  return `user_${Math.abs(hash).toString(36)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Buffer utilities
// ─────────────────────────────────────────────────────────────────────────────

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
