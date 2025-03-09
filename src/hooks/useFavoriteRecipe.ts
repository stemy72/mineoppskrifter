import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { handleSupabaseError } from '../lib/supabase';

interface UseFavoriteRecipeProps {
  initialIsFavorite: boolean;
  recipeId: string;
  onSuccess?: (isFavorite: boolean) => void;
}

export function useFavoriteRecipe({ initialIsFavorite, recipeId, onSuccess }: UseFavoriteRecipeProps) {
  const [isFavorite, setIsFavorite] = useState<boolean>(initialIsFavorite);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFavorite = async () => {
    try {
      setIsUpdating(true);
      setError(null);
      
      const newIsFavorite = !isFavorite;
      
      // Optimistically update the UI state
      setIsFavorite(newIsFavorite);
      
      // Use direct update approach which is more reliable
      const { error: updateError } = await supabase
        .from('recipes')
        .update({ is_favorite: newIsFavorite })
        .eq('id', recipeId);
        
      if (updateError) {
        // Revert the optimistic update if the update fails
        setIsFavorite(!newIsFavorite);
        throw updateError;
      }
      
      // Trigger success callback
      if (onSuccess) {
        onSuccess(newIsFavorite);
      }
    } catch (error) {
      console.error('Error toggling favorite status:', error);
      setError(handleSupabaseError(error));
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    isFavorite,
    isUpdating,
    error,
    toggleFavorite
  };
}