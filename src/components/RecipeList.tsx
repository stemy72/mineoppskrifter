import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChefHat, Star, Clock, LogIn, Tag, Calendar, AlertCircle, RefreshCw, Loader, X, Check, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import MealPlanDialog from './MealPlanDialog';
import { handleSupabaseError } from '../lib/supabase';
import FavoriteButton from './FavoriteButton';

interface Recipe {
  id: string;
  title: string;
  description: string;
  image_url: string;
  created_at: string;
  is_favorite: boolean;
  recipe_tags?: {
    tag_id: string;
  }[];
}

interface Tag {
  id: string;
  name: string;
}

const RECIPES_PER_PAGE = 12;
const MAX_RETRIES = 3;
const SEARCH_DEBOUNCE_DELAY = 600; // 600ms debounce delay for search

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
  const retryCountRef = useRef(0);
  const [isColumnCheckDone, setIsColumnCheckDone] = useState(false);
  const [hasIsFavoriteColumn, setHasIsFavoriteColumn] = useState(false);
  
  // Search functionality
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldRefetchRef = useRef(false);
  
  // Debounce search term to avoid excessive API calls
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      if (searchTerm !== debouncedSearchTerm) {
        setDebouncedSearchTerm(searchTerm);
        setPage(0);
        shouldRefetchRef.current = true;
      }
    }, SEARCH_DEBOUNCE_DELAY);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, debouncedSearchTerm]);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      checkIsFavoriteColumn();
      fetchRecipes(true);
      if (!hasLoadedTags) {
        fetchTags();
      }
    } else {
      setLoading(false);
    }
  }, [user, authLoading, selectedTags, debouncedSearchTerm]);

  const checkIsFavoriteColumn = async () => {
    if (!user || isColumnCheckDone) return;
    
    try {
      const { error: columnCheckError } = await supabase
        .from('recipes')
        .select('is_favorite')
        .limit(1);
      
      setHasIsFavoriteColumn(!columnCheckError);
    } catch (error) {
      console.warn('Error checking is_favorite column:', error);
      setHasIsFavoriteColumn(false);
    } finally {
      setIsColumnCheckDone(true);
    }
  };

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
        retryCountRef.current = 0;
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
          is_favorite,
          recipe_tags!left(tag_id)
        `, { count: 'exact' })
        .eq('user_id', user.id);

      // Always sort by favorites first, then creation date
      query = query.order('is_favorite', { ascending: false })
                  .order('created_at', { ascending: false });
        
      // Apply search if needed
      if (debouncedSearchTerm) {
        query = query.or(`title.ilike.%${debouncedSearchTerm}%,description.ilike.%${debouncedSearchTerm}%`);
      }
      
      // Only try to order by is_favorite if we know the column exists
      if (hasIsFavoriteColumn) {
        query = query.order('is_favorite', { ascending: false });
      }
      
      // Always order by creation date as secondary or primary sort
      query = query.order('created_at', { ascending: false });

      // Apply tag filtering if needed
      if (selectedTags.length > 0) {
        const { data: taggedRecipes, error: tagError } = await supabase
          .from('recipes')
          .select(`
            id,
            recipe_tags!inner (
              tag_id
            )
          `)
          .eq('user_id', user.id)
          .in('recipe_tags.tag_id', selectedTags);

        if (tagError) throw tagError;

        if (thisFetchId !== currentFetchIdRef.current) return;

        if (!taggedRecipes?.length) {
          setRecipes([]);
          setHasMore(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        const matchingIds = Array.from(new Set(taggedRecipes.map(r => r.id)));
        query = query.in('id', matchingIds);
      }

      const { data, count, error } = await query.range(from, to);

      if (thisFetchId !== currentFetchIdRef.current) return;

      if (error) throw error;

      if (!data) {
        setRecipes([]);
        setHasMore(false);
        return;
      }

      const uniqueRecipes = data.map(recipe => ({
        ...recipe,
        recipe_tags: recipe.recipe_tags || [],
        is_favorite: recipe.is_favorite || false
      }));

      setRecipes(reset ? uniqueRecipes : [...recipes, ...uniqueRecipes]);
      setHasMore(count ? from + RECIPES_PER_PAGE < count : false);
      if (!reset) setPage(currentPage + 1);
      retryCountRef.current = 0;
    } catch (error) {
      if (thisFetchId === currentFetchIdRef.current) {
        console.error('Error fetching recipes:', error);
        const errorMessage = handleSupabaseError(error);
        setError(errorMessage);

        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          if (retryCountRef.current < MAX_RETRIES - 1) {
            retryCountRef.current++;
            setTimeout(() => {
              fetchRecipes(reset);
            }, 1000 * retryCountRef.current);
            return;
          }
        }

        if (reset) {
          setRecipes([]);
        }
      }
    } finally {
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
        .from('global_tags')
        .select('id, name')
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

  const handleTagToggle = (tagId: string) => {
    const newSelectedTags = selectedTags.includes(tagId)
      ? selectedTags.filter(id => id !== tagId)
      : [...selectedTags, tagId];
    
    setSelectedTags(newSelectedTags);
    setPage(0);
  };

  const handleClearFilters = useCallback(() => {
    setSelectedTags([]);
    setPage(0);
    fetchRecipes(true);
  }, []);
  
  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setPage(0);
    shouldRefetchRef.current = true;
  }, []);

  const handleRetry = () => {
    retryCountRef.current = 0;
    fetchRecipes(true);
  };

  const handleFavoriteSuccess = (recipeId: string, isFavorite: boolean) => {
    setRecipes(prevRecipes => 
      prevRecipes.map(recipe => 
        recipe.id === recipeId 
          ? { ...recipe, is_favorite: isFavorite }
          : recipe
      )
    );
    
    if (hasIsFavoriteColumn && page === 0) {
      setRecipes(prevRecipes => {
        const sorted = [...prevRecipes].sort((a, b) => {
          if (a.is_favorite !== b.is_favorite) {
            return a.is_favorite ? -1 : 1;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        
        return sorted;
      });
    }
  };

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
            onClick={handleRetry}
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
      </div>

      {tags.length > 0 && (
        <div className="mt-6">
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
                key={`tag-${tag.id}`}
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer transition-colors duration-200 ${
                  selectedTags.includes(tag.id)
                    ? 'bg-indigo-100 text-indigo-800 ring-2 ring-indigo-600'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
                onClick={() => handleTagToggle(tag.id)}
                role="checkbox"
                aria-checked={selectedTags.includes(tag.id)}
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleTagToggle(tag.id);
                  }
                }}
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
            {debouncedSearchTerm || selectedTags.length > 0 ? 'No matching recipes found' : 'No recipes'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {selectedTags.length > 0
              ? 'Try selecting different tags or clear the filters'
              : 'No recipes found.'}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow relative"
              >
                <div className="absolute top-3 right-3 z-10">
                  <FavoriteButton
                    recipeId={recipe.id}
                    initialIsFavorite={recipe.is_favorite}
                    size="md"
                    className="bg-white bg-opacity-75 rounded-full p-1.5 shadow-sm hover:bg-opacity-100"
                    onSuccess={(isFavorite) => handleFavoriteSuccess(recipe.id, isFavorite)}
                  />
                </div>
                
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