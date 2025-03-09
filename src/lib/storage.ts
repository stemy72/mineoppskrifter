import { supabase } from './supabase';
import { optimizeImage } from './image';

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const STORAGE_BUCKET = 'recipes';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const MAX_OUTPUT_SIZE = 500 * 1024; // 500KB

interface ImageValidationResult {
  isValid: boolean;
  error?: string;
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface UploadResult {
  url: string | null;
  error: string | null;
  bucket: string | null;
  path: string | null;
  base64Data?: string;
}

// Convert file to base64
const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Validate image before upload
const validateImage = async (file: File): Promise<ImageValidationResult> => {
  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: 'Only JPG, PNG, and WebP images are allowed'
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: 'Image must be less than 5MB'
    };
  }

  // Validate image dimensions
  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    
    if (dimensions.width < 200 || dimensions.height < 200) {
      return {
        isValid: false,
        error: 'Image must be at least 200x200 pixels'
      };
    }
    
    if (dimensions.width > 4096 || dimensions.height > 4096) {
      return {
        isValid: false,
        error: 'Image dimensions cannot exceed 4096x4096 pixels'
      };
    }
    
    bitmap.close();
    return { isValid: true, dimensions };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid image file'
    };
  }
};

// Helper to generate a unique filename
const generateUniqueFilename = (file: File): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  return `recipe-${timestamp}-${random}.${extension}`;
};

export async function uploadRecipeImage(file: File): Promise<UploadResult> {
  try {
    // Validate image
    const validation = await validateImage(file);
    if (!validation.isValid) {
      return { url: null, error: validation.error, bucket: null, path: null };
    }

    // Optimize image
    const optimizedBlob = await optimizeImage(file);
    
    // Verify optimized size
    if (optimizedBlob.size > MAX_OUTPUT_SIZE) {
      return {
        url: null,
        error: 'Failed to optimize image to target size',
        bucket: null,
        path: null
      };
    }

    // Convert to base64 with proper MIME type
    const base64Data = await fileToBase64(new File([optimizedBlob], 'image.jpg', { type: 'image/jpeg' }));
    if (!base64Data.startsWith('data:image/jpeg;base64,')) {
      return {
        url: null,
        error: 'Invalid image format after optimization',
        bucket: null,
        path: null
      };
    }

    // Verify base64 data size
    const base64Size = base64Data.length * 0.75; // Approximate raw size
    if (base64Size > MAX_OUTPUT_SIZE * 1.37) { // Account for base64 overhead
      return {
        url: null,
        error: 'Image data exceeds maximum allowed size',
        bucket: null,
        path: null
      };
    }

    const optimizedFile = new File([optimizedBlob], file.name, { type: optimizedBlob.type });

    const fileName = generateUniqueFilename(file);

    // Upload file with retry logic
    let retryCount = 0;

    // Get storage client
    const storage = supabase.storage.from(STORAGE_BUCKET);

    while (retryCount < MAX_RETRIES) {
      try {
        const { error: uploadError } = await storage.upload(
          fileName,
          optimizedFile,
          {
            cacheControl: '3600',
            upsert: false,
            contentType: optimizedFile.type,
            duplex: 'half'
          }
        );

        if (uploadError) throw uploadError;
        
        // Get public URL after successful upload
        const { data } = storage.getPublicUrl(fileName);
        
        // Verify URL is accessible
        try {
          const response = await fetch(data.publicUrl);
          if (!response.ok) {
            throw new Error('Failed to verify image URL');
          }

          // Verify size of uploaded image
          const contentLength = response.headers.get('content-length');
          if (contentLength && parseInt(contentLength) > MAX_OUTPUT_SIZE) {
            throw new Error('Uploaded image exceeds maximum size');
          }
        } catch (error) {
          // Try to clean up failed upload
          try {
            await storage.remove([fileName]);
          } catch {
            // Ignore cleanup errors
          }
          throw new Error('Failed to verify uploaded image');
        }

        return {
          url: data.publicUrl,
          error: null,
          bucket: STORAGE_BUCKET,
          path: fileName,
          base64Data: base64Data // Add base64 data to return value
        };

        break;
      } catch (error: any) {
        if (error.statusCode === 503 && retryCount < MAX_RETRIES - 1) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
          continue;
        } else {
          throw error;
        }
      }
    }

    throw new Error('Failed to upload image after retries');
  } catch (error: any) {
    console.error('Error uploading image:', error);
    return {
      url: null,
      error: error.message || 'Failed to process image',
      bucket: null,
      path: null
    };
  }
}

export async function deleteRecipeImage(url: string): Promise<{ error: string | null }> {
  try {
    // Extract file path from URL
    const path = new URL(url).pathname.split('/').pop();
    if (!path) throw new Error('Invalid image URL');

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([path]);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    console.error('Error deleting image:', error);
    return { error: error.message || 'Failed to delete image' };
  }
}