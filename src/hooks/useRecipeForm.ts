import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { handleSupabaseError } from '../lib/supabase';

interface Ingredient {
  id: string;
  name: string;
  amount: string;
  unit: string;
  isSection?: boolean;
}

interface FormData {
  title: string;
  description: string;
  instructions: string;
  imageUrl: string | null;
  sourceUrl: string;
  servings: string;
  cookingTime: string;
  ingredients: Ingredient[];
  selectedTags: string[];
  additionalImages: {
    id?: string;
    url: string;
    order: number;
  }[];
}

const initialFormData: FormData = {
  title: '',
  description: '',
  instructions: '',
  imageUrl: null,
  sourceUrl: '',
  servings: '',
  cookingTime: '',
  ingredients: [{ id: 'initial', name: '', amount: '', unit: '', isSection: false }],
  selectedTags: [],
  additionalImages: []
};

export function useRecipeForm(recipeId?: string) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  useEffect(() => {
    if (recipeId && user) {
      fetchRecipe();
    } else {
      setLoading(false);
    }
  }, [recipeId, user]);

  const fetchRecipe = async () => {
    if (!user || !recipeId) return;

    try {
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .select(`
          *,
          ingredients (
            id,
            name,
            amount,
            unit,
            is_section
          ),
          recipe_tags (
            tag_id
          ),
          recipe_images (
            id,
            image_url,
            order
          )
        `)
        .eq('id', recipeId)
        .single();

      if (recipeError) {
        if (recipeError.code === 'PGRST116') {
          throw new Error('Recipe not found');
        }
        throw recipeError;
      }

      if (recipe.user_id !== user.id) {
        throw new Error('You do not have permission to edit this recipe');
      }
      
      setFormData({
        title: recipe.title,
        description: recipe.description ?? '',
        instructions: recipe.instructions,
        imageUrl: recipe.image_url || null,
        sourceUrl: recipe.source_url ?? '',
        servings: recipe.servings?.toString() ?? '',
        cookingTime: recipe.cooking_time?.toString() ?? '',
        selectedTags: recipe.recipe_tags.map(rt => rt.tag_id),
        ingredients: recipe.ingredients?.length > 0 
          ? recipe.ingredients.map(ing => ({
              id: ing.id,
              name: ing.name,
              amount: ing.amount?.toString() ?? '',
              unit: ing.unit ?? '',
              isSection: ing.is_section
            }))
          : initialFormData.ingredients,
        additionalImages: recipe.recipe_images?.map(img => ({
          id: img.id,
          url: img.image_url,
          order: img.order
        })) || []
      });
    } catch (error) {
      console.error('Error fetching recipe:', error);
      setError(handleSupabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData(prev => {
      // Special handling for additionalImages
      if (field === 'additionalImages') {
        // Ensure images are ordered correctly
        const newImages = value.map((img: any, index: number) => ({
          ...img,
          order: index
        }));
        return { ...prev, [field]: newImages };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Validate required fields
      if (!formData.title.trim()) {
        throw new Error('Recipe title is required');
      }

      if (!formData.ingredients.some(ing => ing.name.trim())) {
        throw new Error('At least one ingredient is required');
      }

      if (!formData.instructions.trim()) {
        throw new Error('Cooking instructions are required');
      }

      let savedRecipeId = recipeId;

      // Prepare ingredients data
      const ingredients = formData.ingredients
        .filter(ing => ing.name.trim())
        .map(ingredient => ({
          name: ingredient.name.trim(),
          amount: ingredient.amount ? Number(ingredient.amount) : null,
          unit: ingredient.unit.trim() || null,
          is_section: ingredient.isSection || false
        }));

      if (recipeId) {
        // Update existing recipe
        const { error: updateError } = await supabase
          .from('recipes')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim(),
            instructions: formData.instructions.trim(),
            image_url: formData.imageUrl,
            source_url: formData.sourceUrl.trim() || null,
            servings: formData.servings ? parseInt(formData.servings) : null,
            cooking_time: formData.cookingTime ? parseInt(formData.cookingTime) : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', recipeId)
          .eq('user_id', user.id);

        if (updateError) throw updateError;

        // Update ingredients
        const { error: deleteIngredientsError } = await supabase
          .from('ingredients')
          .delete()
          .eq('recipe_id', recipeId);

        if (deleteIngredientsError) throw deleteIngredientsError;

        const { error: insertIngredientsError } = await supabase
          .from('ingredients')
          .insert(ingredients.map(ing => ({ ...ing, recipe_id: recipeId })));

        if (insertIngredientsError) throw insertIngredientsError;

        // Delete all existing images first
        const { error: deleteImagesError } = await supabase
          .from('recipe_images')
          .delete()
          .eq('recipe_id', recipeId);

        if (deleteImagesError) throw deleteImagesError;

        // Insert new images if any exist
        if (formData.additionalImages.length > 0) {
          const { error: insertImagesError } = await supabase
            .from('recipe_images')
            .insert(
              formData.additionalImages.map((img, index) => ({
                recipe_id: recipeId,
                image_url: img.url,
                order: index
              }))
            );

          if (insertImagesError) throw insertImagesError;
        }

        savedRecipeId = recipeId;
      } else {
        // Create new recipe
        const { data: newRecipe, error: createError } = await supabase
          .from('recipes')
          .insert([{
            title: formData.title.trim(),
            description: formData.description.trim(),
            instructions: formData.instructions.trim(),
            image_url: formData.imageUrl,
            source_url: formData.sourceUrl.trim() || null,
            servings: formData.servings ? parseInt(formData.servings) : null,
            cooking_time: formData.cookingTime ? parseInt(formData.cookingTime) : null,
            user_id: user.id
          }])
          .select()
          .single();

        if (createError) throw createError;
        savedRecipeId = newRecipe.id;

        // Insert ingredients
        const { error: ingredientsError } = await supabase
          .from('ingredients')
          .insert(ingredients.map(ing => ({ ...ing, recipe_id: savedRecipeId })));

        if (ingredientsError) throw ingredientsError;

        // Insert additional images
        if (formData.additionalImages.length > 0) {
          const { error: imagesError } = await supabase
            .from('recipe_images')
            .insert(
              formData.additionalImages.map((img, index) => ({
                recipe_id: savedRecipeId,
                image_url: img.url,
                order: index
              }))
            );

          if (imagesError) throw imagesError;
        }
      }

      // Update recipe tags
      if (formData.selectedTags.length > 0) {
        // Delete existing tags first
        if (recipeId) {
          const { error: deleteTagsError } = await supabase
            .from('recipe_tags')
            .delete()
            .eq('recipe_id', recipeId);

          if (deleteTagsError) throw deleteTagsError;
        }

        // Insert new tags
        const { error: tagsError } = await supabase
          .from('recipe_tags')
          .insert(
            formData.selectedTags.map(tagId => ({
              recipe_id: savedRecipeId,
              tag_id: tagId
            }))
          );

        if (tagsError) throw tagsError;
      }

      navigate(`/recipes/${savedRecipeId}`);
    } catch (error) {
      console.error('Error saving recipe:', error);
      setError(handleSupabaseError(error));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !recipeId) return;

    try {
      setDeleting(true);
      setError(null);

      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId)
        .eq('user_id', user.id);

      if (error) throw error;

      navigate('/recipes', { replace: true });
    } catch (error) {
      console.error('Error deleting recipe:', error);
      setError(handleSupabaseError(error));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setDeleting(false);
    }
  };

  return {
    loading,
    error,
    success,
    saving,
    deleting,
    formData,
    updateFormData,
    handleSubmit,
    handleDelete
  };
}