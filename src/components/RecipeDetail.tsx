import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { handleSupabaseError } from '../lib/supabase';
import { ChefHat, Clock, Edit2, AlertCircle, Link2, Star, Share2, X, Tag as TagIcon, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
import ShareRecipeModal from './ShareRecipeModal';
import MealPlanDialog from './MealPlanDialog';
import RecipeCalculator from './RecipeCalculator';

interface Recipe {
  id: string;
  title: string;
  description: string;
  instructions: string;
  image_data: string | null;
  image_url: string | null;
  source_url: string | null;
  servings: number | null;
  cooking_time: number | null;
  created_at: string;
  user_id: string;
  author_name: string | null;
  author_avatar: string | null;
  author_verified: boolean;
  tag_ids: string[];
  tag_names: string[];
  ingredients: {
    id: string;
    name: string;
    amount: number | null;
    unit: string | null;
    is_section: boolean;
  }[];
  additional_images: {
    id: string;
    image_url: string;
    order: number;
  }[];
}

interface CookingLog {
  id: string;
  notes: string | null;
  rating: number | null;
  cooked_at: string;
}

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMealPlanDialog, setShowMealPlanDialog] = useState(false);
  const [cookingLogs, setCookingLogs] = useState<CookingLog[]>([]);
  const [newLog, setNewLog] = useState({
    notes: '',
    rating: 5
  });
  const [showLogForm, setShowLogForm] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<{ id: string; name: string; }[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (id) {
      fetchRecipe();
      fetchCookingLogs();
    }
  }, [user, authLoading, id]);

  const fetchAllTags = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('global_tags')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setAllTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
      setError('Failed to load tags');
    }
  };

  const fetchRecipe = async () => {
    if (!user || !id) return;

    try {
      setLoading(true);
      setError(null);
      
      // Fetch all available tags
      await fetchAllTags();

      // Get recipe details with global tags
      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes')
        .select('*, ingredients!left(*), recipe_tags!left(tag_id, global_tags(*)), recipe_images!left(*)')
        .eq('id', id)
        .single();

      if (recipeError) {
        // Handle specific error cases
        if (recipeError.code === 'PGRST116') {
          throw new Error('Recipe not found or you do not have access to it');
        } else {
          throw recipeError;
        }
      }
      
      if (!recipeData) {
        throw new Error('Recipe not found or you do not have access to it');
      }

      // Transform recipe tags data
      const tagIds: string[] = [];
      const tagNames: string[] = [];
      if (recipeData.recipe_tags) {
        recipeData.recipe_tags.forEach(rt => {
          if (rt.global_tags) {
            tagIds.push(rt.global_tags.id);
            tagNames.push(rt.global_tags.name);
          }
        });
      }

      // Transform the data to match Recipe interface
      const transformedRecipe: Recipe = {
        id: recipeData.id,
        title: recipeData.title,
        description: recipeData.description,
        instructions: recipeData.instructions,
        image_url: recipeData.image_url,
        image_data: recipeData.image_data,
        source_url: recipeData.source_url,
        servings: recipeData.servings,
        cooking_time: recipeData.cooking_time,
        created_at: recipeData.created_at,
        user_id: recipeData.user_id,
        author_name: recipeData.author_name,
        author_avatar: recipeData.author_avatar,
        author_verified: recipeData.author_verified,
        tag_ids: tagIds,
        tag_names: tagNames,
        ingredients: recipeData.ingredients || [],
        additional_images: recipeData.recipe_images || []
      };

      setRecipe(transformedRecipe);
    } catch (error) {
      console.error('Error fetching recipe:', error);
      setError(handleSupabaseError(error));
      
      // Redirect to recipes list for not found/access errors
      const errorMsg = error?.message?.toLowerCase() || '';
      if (errorMsg.includes('not found') || errorMsg.includes('access')) {
        navigate('/recipes');
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCookingLogs = async () => {
    if (!user || !id) return;

    try {
      const { data, error } = await supabase
        .from('cooking_logs')
        .select('*')
        .eq('recipe_id', id)
        .eq('user_id', user.id)
        .order('cooked_at', { ascending: false });

      if (error) throw error;
      setCookingLogs(data || []);
    } catch (error) {
      console.error('Error fetching cooking logs:', error);
    }
  };

  const addCookingLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;

    try {
      const { error } = await supabase
        .from('cooking_logs')
        .insert([{
          recipe_id: id,
          user_id: user.id,
          notes: newLog.notes.trim(),
          rating: newLog.rating,
          cooked_at: new Date().toISOString()
        }]);

      if (error) throw error;

      setNewLog({ notes: '', rating: 5 });
      setShowLogForm(false);
      fetchCookingLogs();
    } catch (error) {
      console.error('Error adding cooking log:', error);
      setError('Failed to add cooking log');
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <ChefHat className="mx-auto h-12 w-12 text-gray-400" />
        <h2 className="mt-4 text-lg font-medium text-gray-900">Recipe not found</h2>
        <p className="mt-2 text-gray-500">
          The recipe you're looking for doesn't exist or you don't have access to it.
        </p>
        <Link
          to="/recipes"
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Back to Recipes
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Recipe Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{recipe.title}</h1>
        <div className="flex items-center gap-2">
          {recipe.user_id === user?.id ? (
            <>
              <Link
                to={`/recipes/edit/${recipe.id}`}
                className="inline-flex items-center p-2 sm:px-4 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                title="Edit Recipe"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Edit Recipe</span>
              </Link>
              <button
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center p-2 sm:px-4 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                title="Share"
              >
                <Share2 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Share</span>
              </button>
            </>
          ) : null}
          <button
            onClick={() => setShowMealPlanDialog(true)}
            className="inline-flex items-center p-2 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700"
            title="Add to Meal Plan"
          >
            <Calendar className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add to Meal Plan</span>
          </button>
        </div>
      </div>

      {/* Recipe Image */}
      {(recipe.image_url || recipe.image_data) && (
        <div className="mb-8">
          {/* Main image */}
          <img
            src={recipe.image_data || recipe.image_url}
            alt={recipe.title}
            className="w-full h-48 sm:h-64 object-cover rounded-lg shadow-md cursor-pointer"
            onClick={() => setShowImageModal(true)}
          />
          
          {/* Additional images */}
          {recipe.additional_images && recipe.additional_images.length > 0 && (
            <div className="mt-4 grid grid-cols-5 gap-4 sm:gap-2">
              {recipe.additional_images
                .sort((a, b) => a.order - b.order)
                .map((image) => (
                  <div 
                    key={image.id}
                    className="relative aspect-square rounded-lg overflow-hidden shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      setSelectedImage(image.image_url);
                      setShowImageModal(true);
                    }}
                  >
                    <img
                      src={image.image_url}
                      alt={`Additional photo of ${recipe.title}`}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && (selectedImage || recipe.image_data || recipe.image_url) && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => {
            setShowImageModal(false);
            setSelectedImage(null);
          }}
        >
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => {
                setShowImageModal(false);
                setSelectedImage(null);
              }}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={selectedImage || recipe.image_data || recipe.image_url}
              alt={recipe.title}
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Recipe Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {recipe.servings && (
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center text-gray-500 mb-1">
              <Users className="h-5 w-5 mr-2" />
              <span className="text-sm font-medium">Servings</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">{recipe.servings}</p>
          </div>
        )}

        {recipe.cooking_time && (
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center text-gray-500 mb-1">
              <Clock className="h-5 w-5 mr-2" />
              <span className="text-sm font-medium">Cooking Time</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">{recipe.cooking_time} minutes</p>
          </div>
        )}

        {cookingLogs.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center text-gray-500 mb-1">
              <Star className="h-5 w-5 mr-2" />
              <span className="text-sm font-medium">Last Cooked</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {format(new Date(cookingLogs[0].cooked_at), 'MMM d, yyyy')}
            </p>
          </div>
        )}

        {recipe.source_url && (
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center text-gray-500 mb-1">
              <Link2 className="h-5 w-5 mr-2" />
              <span className="text-sm font-medium">Source</span>
            </div>
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-500 truncate block"
            >
              {new URL(recipe.source_url).hostname}
            </a>
          </div>
        )}
      </div>

      {/* Recipe Description */}
      {recipe.description && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">About</h2>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-gray-600">{recipe.description}</p>
          </div>
        </div>
      )}

      {/* Recipe Tags */}
      {recipe.tag_names && recipe.tag_names.length > 0 && (
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            {recipe.tag_names.map((tagName, index) => (
              <span
                key={`${recipe.tag_ids?.[index] || index}`}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800"
              >
                <TagIcon className="h-4 w-4 mr-1" />
                {tagName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recipe Calculator */}
      <RecipeCalculator
        originalServings={recipe.servings}
        ingredients={recipe.ingredients}
      />

      {/* Two-column layout for ingredients and instructions */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        {/* Left column - Ingredients */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8 lg:mb-0 sticky top-4">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Ingredients</h2>
              <ul className="space-y-2">
                {recipe.ingredients?.map((ingredient) => (
                  <li 
                    key={ingredient.id} 
                    className={`${
                      ingredient.is_section
                        ? 'font-bold text-gray-900 mt-6 first:mt-0' 
                        : 'text-gray-600'
                    }`}
                  >
                    {ingredient.is_section ? (
                      ingredient.name
                    ) : (
                      <span>
                        {ingredient.amount && ingredient.unit 
                          ? `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`
                          : ingredient.name
                        }
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right column - Instructions and Cooking Log */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Instructions</h2>
              <div className="prose max-w-none text-gray-600">
                {recipe.instructions.split('\n').map((paragraph, index) => (
                  <p key={index} className="mb-4">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Cooking Log Section */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Cooking Log</h2>
                <button
                  onClick={() => setShowLogForm(!showLogForm)}
                  className="inline-flex items-center px-3 py-1.5 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50"
                >
                  <Star className="h-4 w-4 mr-1" />
                  Add Entry
                </button>
              </div>

              {showLogForm && (
                <form onSubmit={addCookingLog} className="mb-6 bg-gray-50 p-4 rounded-lg">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rating
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setNewLog(prev => ({ ...prev, rating }))}
                          className={`p-1 rounded-full ${
                            newLog.rating >= rating ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                        >
                          <Star className="h-6 w-6 fill-current" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={newLog.notes}
                      onChange={(e) => setNewLog(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="Add your cooking notes..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLogForm(false)}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                      Save Entry
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                {cookingLogs.map((log) => (
                  <div key={log.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              log.rating && log.rating >= star ? 'text-yellow-400 fill-current' : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-500">
                        {format(new Date(log.cooked_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    {log.notes && (
                      <p className="text-gray-700 whitespace-pre-wrap">{log.notes}</p>
                    )}
                  </div>
                ))}
                {cookingLogs.length === 0 && !showLogForm && (
                  <p className="text-center text-gray-500 py-4">
                    No cooking logs yet. Add your first entry!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <ShareRecipeModal
          recipeId={recipe.id}
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Meal Plan Dialog */}
      {showMealPlanDialog && (
        <MealPlanDialog
          isOpen={showMealPlanDialog}
          onClose={() => setShowMealPlanDialog(false)}
          recipeId={recipe.id}
        />
      )}
    </div>
  );
}