import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ChefHat, Lock, AlertCircle, Check, Loader, ArrowLeft, Trash2, Users, Clock, Plus, X, Tag } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useRecipeForm } from '../hooks/useRecipeForm';
import ImageUpload from './ImageUpload';
import IngredientsManager from './IngredientsManager';
import { ConfirmDialog } from './ui/ConfirmDialog';

interface FormData {
  title: string;
  description: string;
  sourceUrl: string;
  imageUrl: string;
  servings: number;
  cookingTime: number;
  ingredients: string[];
  instructions: string;
  selectedTags: string[];
  additionalImages: {
    id?: string;
    url: string;
    order: number;
  }[];
}

function RecipeForm() {
  const { id: recipeId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tags, setTags] = useState<{ id: string; name: string; }[]>([]);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  
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
      return;
    }
    fetchTags();
  }, [user, authLoading]);

  const fetchTags = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('global_tags')
        .select('*')
        .order('name');

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const createNewTag = async () => {
    if (!user || !newTagName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('global_tags')
        .insert([{
          name: newTagName.trim()
        }])
        .select()
        .single();

      if (error) throw error;

      setTags(prev => [...prev, data]);
      updateFormData('selectedTags', [...formData.selectedTags, data.id]);
      setNewTagName('');
      setShowNewTagInput(false);
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const handleNewTag = (e: React.FormEvent) => {
    e.preventDefault();
    createNewTag();
  };

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
        <div className="bg-white rounded-lg shadow-md p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipe Image
          </label>
          <ImageUpload
            value={formData.imageUrl}
            onChange={(url) => updateFormData('imageUrl', url)}
          />

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => updateFormData('title', e.target.value)}
            required
            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Source URL
          </label>
          <input
            type="url"
            value={formData.sourceUrl}
            onChange={(e) => updateFormData('sourceUrl', e.target.value)}
            placeholder="https://example.com/recipe"
            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          <p className="mt-1 text-sm text-gray-500">Optional: Link to the original recipe source</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  Servings
                </div>
              </label>
              <input
                type="number"
                min="1"
                value={formData.servings}
                onChange={(e) => updateFormData('servings', e.target.value)}
                placeholder="Number of servings"
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  Cooking Time (minutes)
                </div>
              </label>
              <input
                type="number"
                min="1"
                value={formData.cookingTime}
                onChange={(e) => updateFormData('cookingTime', e.target.value)}
                placeholder="Total cooking time"
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Images (up to 5)
          </label>
          <div className="space-y-4">
            {formData.additionalImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {formData.additionalImages
                  .sort((a, b) => a.order - b.order)
                  .map((image, index) => (
                    <div key={image.id || index} className="relative aspect-square">
                      <img
                        src={image.url}
                        alt={`Recipe photo ${index + 1}`}
                        className="absolute inset-0 w-full h-full object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newImages = formData.additionalImages.filter(
                            (_, i) => i !== index
                          );
                          updateFormData('additionalImages', newImages);
                        }}
                        className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {formData.additionalImages.length < 5 && (
              <ImageUpload
                value={null}
                onChange={(url) => {
                  if (url) {
                    const newImage = {
                      url,
                      order: formData.additionalImages.length
                    };
                    updateFormData('additionalImages', [
                      ...formData.additionalImages,
                      newImage
                    ]);
                  }
                }}
              />
            )}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Add up to 5 additional images to showcase your recipe
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => updateFormData('description', e.target.value)}
            rows={3}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Tags
            </label>
            <button
              type="button"
              onClick={() => setShowNewTagInput(true)}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              Add New Tag
            </button>
          </div>
          
          {showNewTagInput && (
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Enter new tag name"
                className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                autoFocus
              />
              <button
                type="button"
                onClick={handleNewTag}
                disabled={!newTagName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <Plus className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewTagInput(false);
                  setNewTagName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  updateFormData('selectedTags', 
                    formData.selectedTags.includes(tag.id)
                      ? formData.selectedTags.filter(id => id !== tag.id)
                      : [...formData.selectedTags, tag.id]
                  );
                }}
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                  formData.selectedTags.includes(tag.id)
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                } hover:bg-green-50`}
              >
                <Tag className="h-4 w-4 mr-1" />
                {tag.name}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ingredients
          </label>
          <IngredientsManager
            ingredients={formData.ingredients}
            onChange={(ingredients) => updateFormData('ingredients', ingredients)}
          />
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Instructions
          </label>
          <textarea
            value={formData.instructions}
            onChange={(e) => updateFormData('instructions', e.target.value)}
            rows={6}
            required
            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-end mt-6">
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

export default RecipeForm;