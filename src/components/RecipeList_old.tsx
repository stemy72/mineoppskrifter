import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChefHat, Star, Clock, LogIn, Tag, Calendar, AlertCircle, RefreshCw, Loader, X, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import MealPlanDialog from './MealPlanDialog';
import { handleSupabaseError } from '../lib/supabase';

interface Recipe {
  id: string;
  title: string;
  description: string;
  image_url: string;
  created_at: string;
  recipe_tags?: {
    tag_id: string;
  }[];
}

interface Tag {
  id: string;
  name: string;
}

const RECIPES_PER_PAGE = 12;

function RecipeList() {
  const { user, loading: authLoading } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedTags, setHasLoadedTags] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [showMealPlanDialog, setShowMealPlanDialog] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const currentFetchIdRef = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      fetchRecipes(true);
      if (!hasLoadedTags) {
        fetchTags();
      }
    } else {
      setLoading(false);
    }
  }, [user, authLoading, selectedTags]);

  const fetchRecipes = async (reset = false) => {
    if (!user) return;

    // Generate unique ID for this fetch
    const thisFetchId = Date.now();
    currentFetchIdRef.current = thisFetchId;

    try {
      const currentPage = reset ? 0 : page;
      const from = currentPage * RECIPES_PER_PAGE;
      const to = from + RECIPES_PER_PAGE - 1;

      if (reset) {
        setLoading(true);
        setRecipes([]);
        setPage(0);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      let query = supabase
        .from('recipes')
        .select(`
          id,
          title,
          description,
          image_url,
          created_at,
          recipe_tags!left (
            tag_id
          )
        `, { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Apply tag filtering if needed
      if (selectedTags.length > 0) {
        // First get recipe IDs that have any of the selected tags
        const { data: taggedRecipes, error: tagError } = await supabase
          .from('recipe_tags')
          .select('recipe_id')
          .in('tag_id', selectedTags);

        if (tagError) throw tagError;

        // Check if this is still the latest fetch
        if (thisFetchId !== currentFetchIdRef.current) return;

        if (!taggedRecipes?.length) {
          setRecipes([]);
          setHasMore(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        // Get unique recipe IDs that match any selected tag
        const matchingIds = Array.from(new Set(taggedRecipes.map(r => r.recipe_id)));
        query = query.in('id', matchingIds);
      }

      // Execute query with pagination
      const { data, count, error } = await query.range(from, to);

      // Check if this is still the latest fetch
      if (thisFetchId !== currentFetchIdRef.current) return;

      if (error) throw error;

      if (!data) {
        setRecipes([]);
        setHasMore(false);
        return;
      }

      // Process recipes and ensure uniqueness
      const uniqueRecipes = data.map(recipe => ({
        ...recipe,
        recipe_tags: recipe.recipe_tags || []
      }));

      setRecipes(reset ? uniqueRecipes : [...recipes, ...uniqueRecipes]);
      setHasMore(count ? from + RECIPES_PER_PAGE < count : false);
      if (!reset) setPage(currentPage + 1);
    } catch (error) {
      // Only update error state if this is still the latest fetch
      if (thisFetchId === currentFetchIdRef.current) {
        console.error('Error fetching recipes:', error);
        setError(handleSupabaseError(error));
        if (reset) {
          setRecipes([]);
        }
      }
    } finally {
      // Only update loading states if this is still the latest fetch
      if (thisFetchId === currentFetchIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  const fetchTags = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      setTags(data || []);
      setHasLoadedTags(true);
    } catch (error) {
      console.error('Error fetching tags:', error);
      setError('Failed to load tags. Some filtering options may be unavailable.');
    }
  };

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchRecipes();
    }
  }, [loadingMore, hasMore]);

  useEffect(() => {
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore) {
          handleLoadMore();
        }
      },
      { threshold: 0.5 }
    );

    const sentinel = document.getElementById('load-more-sentinel');
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, handleLoadMore]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader className="h-12 w-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center">
          <ChefHat className="mx-auto h-16 w-16 text-indigo-600" />
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Welcome to RecipeKeeper</h2>
          <p className="mt-2 text-gray-600 max-w-sm mx-auto">
            Sign in to start managing your recipes and cooking adventures
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <LogIn className="h-5 w-5 mr-2" />
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="bg-red-50 p-6 rounded-lg">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="mt-4 text-lg font-medium text-red-800">Unable to Load Recipes</h2>
          <p className="mt-2 text-red-600">{error}</p>
          <button
            onClick={() => fetchRecipes(true)}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">My Recipes</h1>
          <p className="mt-2 text-sm text-gray-700">
            {recipes.length === 0 && !loading
              ? "You haven't created any recipes yet"
              : `You have ${recipes.length} recipe${recipes.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            to="/recipes/new"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            Add Recipe
          </Link>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-700">Filter by Tags</h2>
            {selectedTags.length > 0 && (
              <button
                onClick={() => {
                  setSelectedTags([]);
                  setPage(0);
                }}
                className="text-sm text-red-600 hover:text-red-700 flex items-center"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filters ({selectedTags.length})
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={`tag-${tag.id}`}
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer transition-colors duration-200 ${
                  selectedTags.includes(tag.id)
                    ? 'bg-indigo-100 text-indigo-800 ring-2 ring-indigo-600'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
                onClick={() => {
                  const newTags = selectedTags.includes(tag.id)
                    ? selectedTags.filter(id => id !== tag.id)
                    : [...selectedTags, tag.id];
                  setSelectedTags(newTags);
                  setPage(0);
                }}
                role="checkbox"
                aria-checked={selectedTags.includes(tag.id)}
              >
                <Tag className="h-4 w-4 mr-1" />
                {tag.name}
                {selectedTags.includes(tag.id) && (
                  <Check className="h-4 w-4 ml-1.5" />
                )}
              </button>
            ))}
          </div>
          {selectedTags.length > 0 && (
            <p className="mt-2 text-sm text-gray-500">
              Showing recipes with any of the selected tags ({selectedTags.length} {selectedTags.length === 1 ? 'tag' : 'tags'})
            </p>
          )}
        </div>
      )}
      
      {loading ? (
        <div className="mt-12 flex justify-center">
          <Loader className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="mt-12 text-center">
          <ChefHat className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {selectedTags.length > 0 ? 'No matching recipes found' : 'No recipes'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {selectedTags.length > 0
              ? 'Try selecting different tags or clear the filters'
              : 'Get started by creating a new recipe.'}
          </p>
          <div className="mt-6">
            <Link
              to="/recipes/new"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Add Recipe
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe, index) => (
              <div
                key={`recipe-${recipe.id}-${index}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <Link to={`/recipes/${recipe.id}`} className="block">
                  {recipe.image_url ? (
                    <img
                      src={recipe.image_url}
                      alt={recipe.title}
                      className="w-full h-48 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                      <ChefHat className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-lg font-medium text-gray-900">{recipe.title}</h3>
                    {recipe.description && (
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">{recipe.description}</p>
                    )}
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{format(new Date(recipe.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </Link>
                <div className="px-4 py-3 bg-gray-50 border-t">
                  <button
                    onClick={() => {
                      setSelectedRecipe(recipe.id);
                      setShowMealPlanDialog(true);
                    }}
                    className="w-full text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    Add to Meal Plan
                  </button>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div
              id="load-more-sentinel"
              className="flex justify-center py-8"
            >
              {loadingMore && <Loader className="h-8 w-8 animate-spin text-indigo-600" />}
            </div>
          )}
        </>
      )}

      {showMealPlanDialog && selectedRecipe && (
        <MealPlanDialog
          isOpen={showMealPlanDialog}
          onClose={() => {
            setShowMealPlanDialog(false);
            setSelectedRecipe(null);
          }}
          recipeId={selectedRecipe}
        />
      )}
    </div>
  );
}

export default React.memo(RecipeList);