import React from 'react';
import ImageUpload from '../../ImageUpload';

interface RecipeImageSectionProps {
  imageData: string | null;
  onImageChange: (data: string | null) => void;
}

export function RecipeImageSection({ imageData, onImageChange }: RecipeImageSectionProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Recipe Image
      </label>
      <ImageUpload
        value={imageData}
        onChange={onImageChange}
      />
    </div>
  );
}