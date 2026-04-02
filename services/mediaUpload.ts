// Openflou Media Upload Service - Upload files to Supabase Storage
import { getSupabaseClient } from '@/template';
import { Platform } from 'react-native';

const BUCKET = 'openflou-media';

/**
 * Upload any local file URI to Supabase storage.
 * Returns the public URL or null on failure.
 */
export async function uploadMedia(
  uri: string,
  userId: string,
  type: 'image' | 'voice' | 'file' = 'file'
): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();

    // Determine extension and mime type
    const filename = uri.split('/').pop() || 'file';
    const ext = filename.split('.').pop() || 'bin';
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      mp4: 'audio/mp4',
      m4a: 'audio/m4a',
      aac: 'audio/aac',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      caf: 'audio/x-caf',
    };
    const mimeType = mimeMap[ext.toLowerCase()] || 'application/octet-stream';

    const folder = type === 'image' ? 'images' : type === 'voice' ? 'voice' : 'files';
    const path = `${folder}/${userId}_${Date.now()}.${ext}`;

    let uploadData: ArrayBuffer;

    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      uploadData = await response.arrayBuffer();
    } else {
      // Mobile: read as base64 then convert
      const response = await fetch(uri);
      const blob = await response.blob();
      uploadData = await blobToArrayBuffer(blob);
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, uploadData, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Upload media error:', error);
    return null;
  }
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}
