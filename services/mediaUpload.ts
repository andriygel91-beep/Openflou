// Openflou Media Upload Service - Upload files to Supabase Storage
import { getSupabaseClient } from '@/template';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const BUCKET = 'openflou-media';

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  // Video
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  // Audio
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  caf: 'audio/x-caf',
  ogg: 'audio/ogg',
  // Documents
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};

/**
 * Upload any local file URI to Supabase storage.
 * Returns the public URL or null on failure.
 */
export async function uploadMedia(
  uri: string,
  userId: string,
  type: 'image' | 'video' | 'voice' | 'file' = 'file'
): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();

    // Determine extension and mime type
    const filename = uri.split('/').pop()?.split('?')[0] || 'file';
    const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
    const mimeType = MIME_MAP[ext] || 'application/octet-stream';

    const folder = type === 'image' ? 'images'
      : type === 'video' ? 'videos'
      : type === 'voice' ? 'voice'
      : 'files';
    const path = `${folder}/${userId}_${Date.now()}.${ext}`;

    let uploadData: ArrayBuffer;

    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      uploadData = await response.arrayBuffer();
    } else {
      // Native: use expo-file-system for reliable reading
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        uploadData = base64ToArrayBuffer(base64);
      } catch {
        // Fallback to fetch
        const response = await fetch(uri);
        const blob = await response.blob();
        uploadData = await blobToArrayBuffer(blob);
      }
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, uploadData, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error.message);
      return null;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    console.log('✅ Uploaded media:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Upload media error:', error);
    return null;
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}
