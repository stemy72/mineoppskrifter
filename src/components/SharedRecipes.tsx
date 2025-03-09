import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChefHat, Star, Clock, LogIn, Tag, Calendar, AlertCircle, RefreshCw, Loader, X, Check, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import MealPlanDialog from './MealPlanDialog';
import { handleSupabaseError } from '../lib/supabase';

interface Recipe {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  image_data: string | null;
  created_at: string;
  user_id: string;
  author_name: string | null;
  author_avatar: string | null;
  author_verified: boolean;
  tag_ids: string[];
  tag_names: string[];
}

interface Tag {
  id: string;
  name: string;
}

const RECIPES_PER_PAGE = 12;
const MAX_RETRIES = 3;

export default function SharedRecipes() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [showMealPlanDialog, setShowMealPlanDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (user) {
      fetchTags();
      fetchSharedRecipes(true);
    }
  }, [user, selectedTags]);

  const fetchTags = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
      setError('Failed to load tags');
    }
  };

  const fetchSharedRecipes = async (reset = false) => {
    if (!user) return;

    try {
      if (reset) {
        setLoading(true);
        setRecipes([]);
        setPage(0);
        retryCountRef.current = 0;
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const from = page * RECIPES_PER_PAGE;
      const to = from + RECIPES_PER_PAGE - 1;

      // Use the optimized function with pagination
      const { data, error, count } = await supabase
        .rpc('get_shared_recipes_with_tags', {
          user_email: user.email,
          tag_filter: selectedTags.length > 0 ? selectedTags : null
        })
        .range(from, to)
        .select('*', { count: 'exact' });

      if (error) throw error;

      if (!data || data.length === 0) {
        setRecipes(reset ? [] : recipes);
        setHasMore(false);
      } else {
        setRecipes(reset ? data : [...recipes, ...data]);
        setHasMore(count ? from + RECIPES_PER_PAGE < count : false);
        if (!reset) setPage(prev => prev + 1);
      }

      retryCountRef.current = 0; // Reset retry count on success
    } catch (error) {
      console.error('Error fetching shared recipes:', error);
      
      // Implement retry logic for network errors
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          setTimeout(() => {
            fetchSharedRecipes(reset);
          }, 1000 * retryCountRef.current); // Exponential backoff
          return;
        }
      }
      
      setError(handleSupabaseError(error));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleTagToggle = useCallback((tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
    setPage(0); // Reset pagination when filters change
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedTags([]);
    setPage(0);
    fetchSharedRecipes(true);
  }, []);

  const handleAddToMealPlan = useCallback((recipeId: string) => {
    setSelectedRecipe(recipeId);
    setShowMealPlanDialog(true);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchSharedRecipes(false);
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

  const RecipeAuthor = React.memo(({ recipe }: { recipe: Recipe }) => {
    return (
      <div className="flex items-center space-x-2 group">
        <div className="relative">
          {recipe.author_avatar ? (
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100">
              <img
                src={recipe.author_avatar}
                alt={recipe.author_name || 'Recipe author'}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <ChefHat className="h-4 w-4 text-gray-400" />
            </div>
          )}
          {recipe.author_verified && (
            <Check className="absolute -bottom-1 -right-1 w-4 h-4 text-primary-300 bg-white rounded-full" />
          )}
        </div>
        <span className="text-sm font-medium text-gray-700 group-hover:text-primary-300 transition-colors">
          {recipe.author_name || 'Anonymous Chef'}
        </span>
      </div>
    );
  });

  const RecipeCard = React.memo(({ recipe }: { recipe: Recipe }) => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <Link to={`/recipes/${recipe.id}`}>
        {recipe.image_url || recipe.image_data ? (
          <img
            src={recipe.image_data || recipe.image_url}
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{recipe.title}</h3>
          <p className="text-gray-600 text-sm line-clamp-2 mb-4">{recipe.description}</p>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>{format(new Date(recipe.created_at), 'MMM d, yyyy')}</span>
            </div>
            <RecipeAuthor recipe={recipe} />
          </div>
        </div>
      </Link>
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
        <button
          onClick={() => handleAddToMealPlan(recipe.id)}
          className="w-full flex items-center justify-center px-3 py-1.5 text-primary-300 hover:bg-primary-50 rounded-md"
        >
          <Calendar className="h-4 w-4 mr-1" />
          Add to Meal Plan
        </button>
      </div>
    </div>
  ));

  if (loading && recipes.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-300"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Shared Recipes</h1>
        <Users className="h-6 w-6 text-primary-300" />
      </div>

      {error && recipes.length === 0 && (
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          <div className="bg-red-50 p-6 rounded-lg">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <h2 className="mt-4 text-lg font-medium text-red-800">Unable to Load Recipes</h2>
            <p className="mt-2 text-red-600">{error}</p>
            <button
              onClick={() => {
                retryCountRef.current = 0;
                fetchSharedRecipes(true);
              }}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </button>
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-700">Filter by Tags</h2>
            {selectedTags.length > 0 && (
              <button
                onClick={handleClearFilters}
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
                key={tag.id}
                onClick={() => handleTagToggle(tag.id)}
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                  selectedTags.includes(tag.id)
                    ? 'bg-primary-100 text-primary-800 ring-2 ring-primary-300'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
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

      {recipes.length === 0 && !loading ? (
        <div className="text-center py-12">
          <ChefHat className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {selectedTags.length > 0 ? 'No matching recipes found' : 'No shared recipes yet'}
          </h3>
          <p className="mt-2 text-gray-500">
            {selectedTags.length > 0
              ? 'Try selecting different tags or clear the filters'
              : 'Recipes shared with you or public recipes will appear here'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
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