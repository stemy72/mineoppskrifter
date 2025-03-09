import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Loader, AlertCircle, Info, FileWarning, Plus, ArrowDownCircle, Minus, Users, Clock, Tag } from 'lucide-react';
import { extractRecipeFromImage } from '../lib/gemini';
import { supabase } from '../lib/supabase';
import { uploadRecipeImage } from '../lib/storage';
import { useAuth } from '../hooks/useAuth';
interface Ingredient {
  name: string;
  amount: number | null;
  unit: string | null;
}

interface ExtractedRecipe {
  title: string;
  description: string;
  servings: number | null;
  cookingTime: number | null;
  ingredients: Ingredient[];
  instructions: string;
}

interface Tag {
  id: string;
  name: string;
}

export default function RecipeImport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editedRecipe, setEditedRecipe] = useState<ExtractedRecipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [servings, setServings] = useState<string>('');
  const [cookingTime, setCookingTime] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from('global_tags')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
      setError('Failed to load tags. Some filtering options may be unavailable.');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be less than 5MB');
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setUploadError('Only JPG, PNG, GIF, and WebP images are allowed');
      return;
    }

    setLoading(true);
    setError(null);
    setUploadError(null);
    try {
      // Convert file to base64 for Gemini API
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64Data = await base64Promise;
      setPreview(base64Data);

      // Extract recipe from image first
      const recipe = await extractRecipeFromImage(base64Data);
      if (!recipe) {
        throw new Error('Failed to extract recipe from image');
      }

      setExtractedRecipe(recipe);
      setEditedRecipe(recipe);

      // Set servings and cooking time if available
      if (recipe.servings) {
        setServings(recipe.servings.toString());
      }
      if (recipe.cookingTime) {
        setCookingTime(recipe.cookingTime.toString());
      }
      
      setIsEditing(true);
    } catch (error: any) {
      console.error('Recipe import error:', error);
      setError(error.message || 'Failed to extract recipe from image');
      
      // Reset form state
      setPreview(null);
      setExtractedRecipe(null);
      setEditedRecipe(null);
      setIsEditing(false);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const saveRecipe = async () => {
    if (!user || !editedRecipe) return;

    try {
      setLoading(true);
      setError(null);
      
      // Convert preview image to File object for upload
      let imageUrl = null;
      if (preview) {
        // Convert base64 to blob
        const response = await fetch(preview);
        const blob = await response.blob();
        const file = new File([blob], 'recipe-image.jpg', { type: 'image/jpeg' });
        
        // Upload to storage
        const { url, error: uploadError } = await uploadRecipeImage(file);
        if (uploadError) {
          throw new Error(uploadError);
        }
        imageUrl = url;
      }

      // Prepare recipe data
      const recipeData = {
        title: editedRecipe.title.trim(),
        description: editedRecipe.description?.trim() || '',
        instructions: editedRecipe.instructions.trim(),
        servings: servings ? parseInt(servings) : null,
        cooking_time: cookingTime ? parseInt(cookingTime) : null,
        image_url: imageUrl || null,
        user_id: user.id,
      };

      // Validate required fields
      if (!recipeData.title) {
        throw new Error('Recipe title is required');
      }
      if (!recipeData.instructions) {
        throw new Error('Recipe instructions are required');
      }

      // Insert recipe
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert([recipeData])
        .select()
        .single();

      if (recipeError) throw recipeError;

      // Insert ingredients if we have any
      if (editedRecipe.ingredients?.length > 0) {
        const validIngredients = editedRecipe.ingredients
          .filter(ing => ing.name.trim())
          .map(ingredient => ({
            recipe_id: recipe.id,
            name: ingredient.name.trim(),
            amount: ingredient.amount,
            unit: ingredient.unit?.trim() || null,
          }));

        if (validIngredients.length > 0) {
          const { error: ingredientsError } = await supabase
            .from('ingredients')
            .insert(validIngredients);

          if (ingredientsError) throw ingredientsError;
        }
      }

      // Insert tags if any are selected
      if (selectedTags.length > 0) {
        const { error: tagsError } = await supabase
          .from('recipe_tags')
          .insert(
            selectedTags.map(tagId => ({
              recipe_id: recipe.id,
              tag_id: tagId
            }))
          );

        if (tagsError) throw tagsError;
      }

      navigate(`/recipes/${recipe.id}`);
    } catch (error: any) {
      console.error('Error saving recipe:', error);
      setError(error.message || 'Failed to save recipe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-0 sm:px-4 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">Import Recipe from Image</h1>

      {!import.meta.env.VITE_GOOGLE_API_KEY && (
        <div className="mb-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg flex items-center">
          <Info className="h-5 w-5 mr-2 flex-shrink-0" />
          <div>
            <p className="font-medium">Gemini API key not configured</p>
            <p className="text-sm mt-1">Please add VITE_GOOGLE_API_KEY to your environment variables to enable recipe extraction.</p>
          </div>
        </div>
      )}

      {(error || uploadError) && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center">
          <FileWarning className="h-5 w-5 mr-2 flex-shrink-0" />
          <div>
            <p className="font-medium">{uploadError ? 'Upload Error' : 'Extraction Error'}</p>
            <p className="text-sm mt-1">{uploadError || error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Image upload */}
        <div>
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
            />
            <div className="space-y-4">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center px-4 py-2 bg-primary-300 text-white rounded-md hover:bg-primary-400"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Select Recipe Image
                </button>
                <p className="text-sm text-gray-500 mt-2">
                  Supports JPEG, PNG, and WebP (max 5MB)
                </p>
              </div>
            </div>
          </div>

          {preview && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-medium text-gray-900">Original Image</h2>
                <button
                  onClick={() => {
                    setPreview(null);
                    setExtractedRecipe(null);
                    setEditedRecipe(null);
                    setIsEditing(false);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  New Image
                </button>
              </div>
              <div className="relative rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={preview}
                  alt="Recipe preview"
                  className="w-full h-auto"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right column - Recipe form */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader className="mx-auto h-8 w-8 animate-spin text-primary-300" />
                <p className="mt-2 text-gray-600">
                  {preview ? 'Extracting recipe...' : 'Processing image...'}
                </p>
              </div>
            </div>
          ) : editedRecipe && isEditing ? (
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    value={editedRecipe.title}
                    onChange={(e) => setEditedRecipe({ ...editedRecipe, title: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-300 focus:ring-primary-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <div className="relative">
                    <textarea
                      value={editedRecipe.description}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length <= 2000) {
                          setEditedRecipe({ ...editedRecipe, description: value });
                          // Auto-adjust height
                          e.target.style.height = 'auto';
                          e.target.style.height = `${Math.min(e.target.scrollHeight, window.innerWidth >= 768 ? 400 : 250)}px`;
                        }
                      }}
                      style={{
                        minHeight: window.innerWidth >= 768 ? '100px' : '80px',
                        resize: 'none'
                      }}
                      className={`
                        w-full rounded-lg border-gray-300 shadow-sm 
                        focus:border-primary-300 focus:ring-primary-300
                        transition-all duration-200 ease-in-out
                        scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent
                        hover:scrollbar-thumb-gray-400
                        p-3 text-base leading-relaxed
                        ${editedRecipe.description.length > 1800 ? 'border-yellow-400' : ''}
                        ${editedRecipe.description.length > 1900 ? 'border-red-400' : ''}
                      `}
                      placeholder="Enter a brief description of your recipe..."
                    />
                    <div className="absolute bottom-2 right-2 text-sm text-gray-500">
                      <span className={`
                        ${editedRecipe.description.length > 1800 ? 'text-yellow-600' : ''}
                        ${editedRecipe.description.length > 1900 ? 'text-red-600' : ''}
                      `}>
                        {editedRecipe.description.length}
                      </span>
                      <span>/2000</span>
                    </div>
                  </div>
                  {editedRecipe.description.length > 1800 && (
                    <p className={`mt-1 text-sm ${
                      editedRecipe.description.length > 1900 ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {editedRecipe.description.length > 1900
                        ? 'Almost at character limit!'
                        : 'Approaching character limit'}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      value={servings}
                      onChange={(e) => setServings(e.target.value)}
                      placeholder="Number of servings"
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-300 focus:ring-primary-300"
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
                      value={cookingTime}
                      onChange={(e) => setCookingTime(e.target.value)}
                      placeholder="Total cooking time"
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-300 focus:ring-primary-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ingredients</label>
                  <div className="space-y-4">
                    {editedRecipe.ingredients.map((ingredient, index) => (
                      <div key={index} className="flex items-center gap-1 sm:gap-1.5 bg-gray-50 rounded-lg p-1.5 sm:p-2">
                        <input
                          type="text"
                          value={ingredient.name}
                          onChange={(e) => {
                            const newIngredients = [...editedRecipe.ingredients];
                            newIngredients[index] = {
                              ...ingredient,
                              name: e.target.value
                            };
                            setEditedRecipe({
                              ...editedRecipe,
                              ingredients: newIngredients
                            });
                          }}
                          placeholder="Ingredient name"
                          className="flex-1 min-w-0 rounded-md border-gray-300 shadow-sm focus:border-primary-300 focus:ring-primary-300 text-sm mr-0.5 sm:mr-1"
                        />
                        <input
                          type="number"
                          value={ingredient.amount || ''}
                          onChange={(e) => {
                            const newIngredients = [...editedRecipe.ingredients];
                            newIngredients[index] = {
                              ...ingredient,
                              amount: e.target.value ? Number(e.target.value) : null
                            };
                            setEditedRecipe({
                              ...editedRecipe,
                              ingredients: newIngredients
                            });
                          }}
                          placeholder="Amt"
                          className="w-10 sm:w-12 rounded-md border-gray-300 shadow-sm focus:border-primary-300 focus:ring-primary-300 text-sm text-center px-0.5 sm:px-1"
                        />
                        <input
                          type="text"
                          value={ingredient.unit || ''}
                          onChange={(e) => {
                            const newIngredients = [...editedRecipe.ingredients];
                            newIngredients[index] = {
                              ...ingredient,
                              unit: e.target.value
                            };
                            setEditedRecipe({
                              ...editedRecipe,
                              ingredients: newIngredients
                            });
                          }}
                          placeholder="Unit"
                          className="w-10 sm:w-12 rounded-md border-gray-300 shadow-sm focus:border-primary-300 focus:ring-primary-300 text-sm text-center px-0.5 sm:px-1"
                        />
                        <div className="flex items-center gap-0.5 sm:gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const newIngredients = [...editedRecipe.ingredients];
                              newIngredients.splice(index + 1, 0, {
                                name: '',
                                amount: null,
                                unit: null
                              });
                              setEditedRecipe({
                                ...editedRecipe,
                                ingredients: newIngredients
                              });
                            }}
                            className="p-1 sm:p-1.5 text-primary-300 hover:text-primary-400 hover:bg-primary-50 rounded-md transition-colors"
                            title="Insert below"
                          >
                            <ArrowDownCircle className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newIngredients = editedRecipe.ingredients.filter(
                                (_, i) => i !== index
                              );
                              setEditedRecipe({
                                ...editedRecipe,
                                ingredients: newIngredients
                              });
                            }}
                            className="p-1 sm:p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                            title="Remove"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setEditedRecipe({
                          ...editedRecipe,
                          ingredients: [
                            ...editedRecipe.ingredients,
                            { name: '', amount: null, unit: null }
                          ]
                        });
                      }}
                      className="w-full flex items-center justify-center px-4 py-2 text-primary-300 border border-primary-300 rounded-lg hover:bg-primary-50"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Add Ingredient
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Instructions</label>
                  <textarea
                    value={editedRecipe.instructions}
                    onChange={(e) => setEditedRecipe({ ...editedRecipe, instructions: e.target.value })}
                    rows={6}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-300 focus:ring-primary-300"
                  />
                </div>

                {/* Tags Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setSelectedTags(prev =>
                            prev.includes(tag.id)
                              ? prev.filter(id => id !== tag.id)
                              : [...prev, tag.id]
                          );
                        }}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                          selectedTags.includes(tag.id)
                            ? 'bg-primary-100 text-primary-800 ring-2 ring-primary-300'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        <Tag className="h-4 w-4 mr-1" />
                        {tag.name}
                      </button>
                    ))}
                    {tags.length === 0 && (
                      <p className="text-sm text-gray-500">
                        No tags available. Please contact an administrator to add global tags.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={saveRecipe}
                    disabled={loading}
                    className="bg-primary-300 text-white px-4 py-2 rounded-lg hover:bg-primary-400 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Recipe'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}