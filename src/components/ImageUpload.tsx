import React, { useCallback, useRef, useState } from 'react';
import { Upload, X, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { uploadRecipeImage } from '../lib/storage';

interface ImageUploadProps {
  value: string | null;
  onChange: (value: string | null) => void;
  onError?: (error: string | null) => void;
}

export default function ImageUpload({ value, onChange, onError }: ImageUploadProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearError = () => {
    setError(null);
    if (onError) onError(null);
  };

  const handleError = (message: string) => {
    setError(message);
    if (onError) onError(message);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      handleError('Image must be less than 5MB');
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      handleError('Only JPG, PNG, GIF, and WebP images are allowed');
      return;
    }

    setLoading(true);
    clearError();
    try {
      const { url, error } = await uploadRecipeImage(file);
      if (error || !url) {
        handleError(error || 'Failed to upload image');
        return;
      }
      onChange(url);
    } catch (error: any) {
      handleError(error.message || 'Failed to upload image');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUrlSubmit = async () => {
    if (!imageUrl.trim()) return;
    if (!imageUrl.startsWith('https://')) {
      handleError('Image URL must be HTTPS');
      return;
    }

    // Validate URL extension
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!validExtensions.some(ext => imageUrl.toLowerCase().endsWith(ext))) {
      handleError('Invalid image URL. Must end with .jpg, .jpeg, .png, .gif, or .webp');
      return;
    }

    setLoading(true);
    clearError();

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error('Failed to load image from URL');
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error('Invalid image type from URL');
      }
      
      const blob = await response.blob();
      if (blob.size > 5 * 1024 * 1024) {
        throw new Error('Image from URL exceeds 5MB size limit');
      }

      const file = new File([blob], 'image.jpg', { type: blob.type });
      
      const { url, error } = await uploadRecipeImage(file);
      if (error || !url) {
        throw new Error(error || 'Failed to upload image');
      }

      if (url) {
        onChange(url);
        setImageUrl('');
      }
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to load image from URL');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveImage = () => {
    onChange(null);
    clearError();
  };

  return (
    <div className="space-y-4">
      {/* Preview */}
      {value ? (
        <div className="relative rounded-lg overflow-hidden bg-gray-100">
          <img
            src={value}
            alt="Preview"
            className="w-full h-48 sm:h-64 object-cover"
          />
          <button
            type="button"
            onClick={handleRemoveImage}
            className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* File upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-500 hover:text-indigo-500 transition-colors disabled:opacity-50"
            >
              <Upload className="h-5 w-5 mr-2" />
              {loading ? 'Processing...' : 'Upload Image'}
            </button>
          </div>

          {/* URL input */}
          <div>
            <div className="text-center text-sm text-gray-500 mb-2">or</div>
            <div className="flex gap-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="flex-1 rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleUrlSubmit}
                disabled={loading || !imageUrl.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Help text */}
      <p className="text-sm text-gray-500">
        Supported formats: JPG, PNG, GIF, WebP (max. 5MB)
      </p>
    </div>
  );
}