import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { supabase, handleSupabaseError } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface FavoriteButtonProps {
  recipeId: string;
  initialIsFavorite: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onSuccess?: (isFavorite: boolean) => void;
}

export default function FavoriteButton({
  recipeId,
  initialIsFavorite,
  size = 'md',
  className = '',
  onSuccess
}: FavoriteButtonProps) {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFavorite = async () => {
    if (!user) return;

    try {
      setIsUpdating(true);
      setError(null);
      
      const newIsFavorite = !isFavorite;
      
      // Optimistically update the UI state
      setIsFavorite(newIsFavorite);
      
      const { data, error: updateError } = await supabase
        .from('recipes')
        .update({ is_favorite: newIsFavorite })
        .eq('id', recipeId)
        .eq('user_id', user.id)
        .select()
        .single();
        
      if (updateError) {
        // Revert the optimistic update if the update fails
        setIsFavorite(!newIsFavorite);
        throw updateError;
      }
      
      // Trigger success callback
      if (onSuccess) {
        onSuccess(data.is_favorite);
      }
    } catch (error: any) {
      // Revert optimistic update on error
      setIsFavorite(!isFavorite);
      console.error('Error toggling favorite status:', error);
      setError(handleSupabaseError(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUpdating) {
      toggleFavorite();
    }
  };

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }[size];

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`transition-colors duration-200 focus:outline-none relative ${className}`}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      disabled={isUpdating}
    >
      <Heart
        className={`${sizeClasses} transition-all duration-300 ${
          isUpdating ? 'animate-pulse' : ''
        } ${
          isFavorite
            ? 'text-red-500 fill-red-500'
            : 'text-gray-400 hover:text-red-500'
        }`}
      />
      {error && (
        <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-100 text-red-700 text-xs px-2 py-1 rounded whitespace-nowrap">
          {error}
        </span>
      )}
    </button>
  );
}