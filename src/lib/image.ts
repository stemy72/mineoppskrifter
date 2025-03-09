// Image validation and conversion utilities

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const MAX_WIDTH = 1200;
export const JPEG_QUALITY = 0.8;
export const MAX_OUTPUT_SIZE = 500 * 1024; // 500KB

export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
  preview?: string;
}

// Process and optimize image
export async function optimizeImage(file: File): Promise<Blob> {
  // Create canvas and load image
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Load image
  const img = await createImageBitmap(file);
  
  // Calculate new dimensions
  let width = img.width;
  let height = img.height;
  
  if (width > MAX_WIDTH) {
    height = Math.round((height * MAX_WIDTH) / width);
    width = MAX_WIDTH;
  }

  // Set canvas dimensions
  canvas.width = width;
  canvas.height = height;

  // Draw and optimize image
  ctx.drawImage(img, 0, 0, width, height);

  let quality = JPEG_QUALITY;
  let blob: Blob;

  // Convert to blob
  blob = await new Promise<Blob>(resolve => {
    canvas.toBlob(
      blob => resolve(blob!),
      'image/jpeg',
      quality
    );
  });

  // Further compress if still too large
  while (blob.size > MAX_OUTPUT_SIZE && quality > 0.5) {
    quality -= 0.1;
    blob = await new Promise<Blob>(resolve => {
      canvas.toBlob(
        blob => resolve(blob!),
        'image/jpeg',
        quality
      );
    });
  }

  // Final size check
  if (blob.size > MAX_OUTPUT_SIZE) {
    throw new Error('Unable to compress image to target size while maintaining quality');
  }

  return blob;
}

// Check if image has transparent pixels
async function hasTransparentPixels(img: ImageBitmap): Promise<boolean> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  // Check alpha values (every 4th value)
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < 255) return true;
  }

  return false;
}

export function validateImageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    // Only allow HTTPS URLs
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }
    // Only allow specific image file extensions
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const hasValidExtension = allowedExtensions.some(ext => 
      parsedUrl.pathname.toLowerCase().endsWith(ext)
    );
    return hasValidExtension;
  } catch {
    return false;
  }
}

export function isValidBase64Image(data: string | null): boolean {
  if (!data) return true; // null is valid (no image)
  return data.startsWith('data:image/') && 
         data.includes(';base64,') && 
         ALLOWED_MIME_TYPES.some(type => data.includes(type.replace('image/', '')));
}

export async function validateAndProcessImage(file: File): Promise<ImageValidationResult> {
  // Size validation
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: 'Image size must be less than 5MB'
    };
  }

  // Type validation
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: 'Only JPG, PNG, GIF, and WebP images are allowed'
    };
  }

  try {
    // Optimize image first
    const optimizedBlob = await optimizeImage(file);
    const preview = await convertToBase64(optimizedBlob);

    if (!preview || !isValidBase64Image(preview)) {
      return {
        isValid: false,
        error: 'Invalid image format'
      };
    }

    return {
      isValid: true,
      preview
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Failed to process image'
    };
  }
}

export async function validateAndProcessImageUrl(url: string): Promise<ImageValidationResult> {
  if (!validateImageUrl(url)) {
    return {
      isValid: false,
      error: 'Invalid image URL. Must be HTTPS and end with .jpg, .jpeg, .png, .gif, or .webp'
    };
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        isValid: false,
        error: 'Failed to fetch image from URL'
      };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !ALLOWED_MIME_TYPES.includes(contentType)) {
      return {
        isValid: false,
        error: 'Invalid image type from URL'
      };
    }

    const blob = await response.blob();
    if (blob.size > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: 'Image from URL exceeds 5MB size limit'
      };
    }

    // Optimize image from URL
    const optimizedBlob = await optimizeImage(new File([blob], 'image.jpg', { type: blob.type }));
    const preview = await convertToBase64(optimizedBlob);

    if (!preview || !isValidBase64Image(preview)) {
      return {
        isValid: false,
        error: 'Invalid image data from URL'
      };
    }

    return {
      isValid: true,
      preview
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Failed to load image from URL'
    };
  }
}

async function convertToBase64(input: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(input);
  });
}

export function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height
      });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
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
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: 'Only JPG, PNG, GIF, and WebP images are allowed'
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
            contentType: optimizedFile.type
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
          path: fileName
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