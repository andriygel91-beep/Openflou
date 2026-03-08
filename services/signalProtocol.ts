// Openflou Signal Protocol E2EE Implementation
import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

// Signal Protocol simplified implementation for E2EE
// This uses browser's SubtleCrypto API for modern encryption

interface KeyPair {
  publicKey: string; // base64
  privateKey: string; // base64
}

interface PreKey {
  keyId: number;
  publicKey: string;
}

interface SignedPreKey extends PreKey {
  signature: string;
}

interface PreKeyBundle {
  registrationId: number;
  identityKey: string;
  signedPreKey: SignedPreKey;
  preKey?: PreKey;
}

// Generate identity key pair (long-term keys)
export async function generateIdentityKeyPair(): Promise<KeyPair> {
  try {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
      publicKey: arrayBufferToBase64(publicKey),
      privateKey: arrayBufferToBase64(privateKey),
    };
  } catch (error) {
    console.error('Failed to generate identity key pair:', error);
    throw error;
  }
}

// Generate registration ID
export function generateRegistrationId(): number {
  return Math.floor(Math.random() * 16384);
}

// Generate prekeys
export async function generatePreKey(keyId: number): Promise<PreKey> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );

  const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);

  return {
    keyId,
    publicKey: arrayBufferToBase64(publicKey),
  };
}

// Sign prekey with identity key
export async function generateSignedPreKey(
  identityKeyPair: KeyPair,
  keyId: number
): Promise<SignedPreKey> {
  const preKey = await generatePreKey(keyId);

  // Import private key for signing
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    base64ToArrayBuffer(identityKeyPair.privateKey),
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['sign']
  );

  // Sign the prekey
  const signature = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    privateKey,
    base64ToArrayBuffer(preKey.publicKey)
  );

  return {
    ...preKey,
    signature: arrayBufferToBase64(signature),
  };
}

// Encrypt message using derived shared secret
export async function encryptMessage(
  plaintext: string,
  recipientPublicKey: string,
  senderPrivateKey: string
): Promise<{ ciphertext: string; iv: string }> {
  try {
    // Import keys
    const recipientPubKey = await crypto.subtle.importKey(
      'spki',
      base64ToArrayBuffer(recipientPublicKey),
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      []
    );

    const senderPrivKey = await crypto.subtle.importKey(
      'pkcs8',
      base64ToArrayBuffer(senderPrivateKey),
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      ['deriveKey']
    );

    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: recipientPubKey,
      },
      senderPrivKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt']
    );

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      sharedSecret,
      data
    );

    return {
      ciphertext: arrayBufferToBase64(encrypted),
      iv: arrayBufferToBase64(iv.buffer),
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw error;
  }
}

// Decrypt message
export async function decryptMessage(
  ciphertext: string,
  iv: string,
  senderPublicKey: string,
  recipientPrivateKey: string
): Promise<string> {
  try {
    // Import keys
    const senderPubKey = await crypto.subtle.importKey(
      'spki',
      base64ToArrayBuffer(senderPublicKey),
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      []
    );

    const recipientPrivKey = await crypto.subtle.importKey(
      'pkcs8',
      base64ToArrayBuffer(recipientPrivateKey),
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      ['deriveKey']
    );

    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: senderPubKey,
      },
      recipientPrivKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['decrypt']
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToArrayBuffer(iv),
      },
      sharedSecret,
      base64ToArrayBuffer(ciphertext)
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw error;
  }
}

// Helper functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Store keys in database
export async function storeUserKeys(
  userId: string,
  identityKeyPair: KeyPair,
  registrationId: number
): Promise<void> {
  try {
    await supabase.from('openflou_users').update({
      identity_public_key: identityKeyPair.publicKey,
      identity_private_key: identityKeyPair.privateKey, // Should be stored encrypted!
      registration_id: registrationId,
    }).eq('id', userId);
  } catch (error) {
    console.error('Failed to store keys:', error);
  }
}

// Get user's public identity key
export async function getUserPublicKey(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('openflou_users')
      .select('identity_public_key')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data?.identity_public_key || null;
  } catch (error) {
    console.error('Failed to get public key:', error);
    return null;
  }
}
