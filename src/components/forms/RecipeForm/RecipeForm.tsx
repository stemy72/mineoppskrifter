import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ChefHat, Lock, AlertCircle, Check, Loader, ArrowLeft, Trash2, Users, Clock } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { handleSupabaseError } from '../../../lib/supabase';
import { useRecipeForm } from './useRecipeForm';
import { RecipeBasicInfo } from './RecipeBasicInfo';
import { RecipeImageSection } from './RecipeImageSection';
import { RecipeTagsSection } from './RecipeTagsSection';
import { RecipeIngredientsSection } from './RecipeIngredientsSection';
import { RecipeInstructionsSection } from './RecipeInstructionsSection';
import { ConfirmDialog } from '../../ui/ConfirmDialog';

export default function RecipeForm() {
  const { id: recipeId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const {
    loading,
    error,
    success,
    saving,
    deleting,
    formData,
    updateFormData,
    handleSubmit,
    handleDelete
  } = useRecipeForm(recipeId);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  if (loading || authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader className="h-12 w-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {recipeId ? 'Edit Recipe' : 'Create New Recipe'}
        </h1>
        <div className="flex items-center gap-4">
          {recipeId && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="inline-flex items-center px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? (
                <Loader className="animate-spin h-5 w-5 mr-2" />
              ) : (
                <Trash2 className="h-5 w-5 mr-2" />
              )}
              Delete Recipe
            </button>
          )}
          <Link
            to="/recipes"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-1" />
            Back to Recipes
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center">
          <Check className="h-5 w-5 mr-2" />
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <RecipeImageSection
          imageData={formData.imageData}
          onImageChange={(data) => updateFormData('imageData', data)}
        />

        <RecipeBasicInfo
          title={formData.title}
          sourceUrl={formData.sourceUrl}
          servings={formData.servings}
          cookingTime={formData.cookingTime}
          description={formData.description}
          onChange={updateFormData}
        />

        <RecipeTagsSection
          selectedTags={formData.selectedTags}
          onChange={(tags) => updateFormData('selectedTags', tags)}
        />

        <RecipeIngredientsSection
          ingredients={formData.ingredients}
          onChange={(ingredients) => updateFormData('ingredients', ingredients)}
        />

        <RecipeInstructionsSection
          instructions={formData.instructions}
          onChange={(instructions) => updateFormData('instructions', instructions)}
        />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 flex items-center"
          >
            {saving ? (
              <>
                <Loader className="animate-spin h-5 w-5 mr-2" />
                {recipeId ? 'Saving...' : 'Creating...'}
              </>
            ) : (
              recipeId ? 'Save Recipe' : 'Create Recipe'
            )}
          </button>
        </div>
      </form>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Recipe"
        message="Are you sure you want to delete this recipe? This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </div>
  );
}