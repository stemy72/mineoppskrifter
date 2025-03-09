import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChefHat, Clock, AlertCircle, RefreshCw, Loader, Calendar, Tag as TagIcon, Check, X, Search } from 'lucide-react';
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
}

interface Tag {
  id: string;
  name: string;
}

const RECIPES_PER_PAGE = 12;
const MAX_RETRIES = 3;
const SEARCH_DEBOUNCE_DELAY = 600; // 600ms debounce delay for search

export default function FastSharedRecipes() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [showMealPlanDialog, setShowMealPlanDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef<IntersectionObserver | null>(null);
  const retryCountRef = useRef(0);
  const isMounted = useRef(true);

  // Tag filtering
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

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

  // Fetch tags for filtering
  const fetchTags = useCallback(async () => {
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
    }
  }, [user]);

  // Fetch shared recipes
  const fetchSharedRecipes = useCallback(async (reset = false, currentPage = 0) => {
    if (!user) return;

    try {
      if (reset) {
        setLoading(true);
        setRecipes([]);
        retryCountRef.current = 0;
      } else {
        setLoadingMore(true);
      }
      setError(null);
      const from = currentPage * RECIPES_PER_PAGE;
      const to = from + RECIPES_PER_PAGE - 1;

      let requestPromise;
      if (selectedTags.length > 0) {
        requestPromise = supabase
          .rpc('get_shared_recipes_with_tags', {
            user_email: user.email,
            tag_filter: selectedTags
          })
          .range(from, to)
          .select('*', { count: 'exact' });
        if (debouncedSearchTerm) {
          requestPromise = requestPromise
            .or(`title.ilike.%${debouncedSearchTerm}%,description.ilike.%${debouncedSearchTerm}%`);
        }
      } else {
        requestPromise = supabase
          .from('shared_recipes_view')
          .select('id, title, description, image_url, image_data, created_at, user_id, author_name, author_avatar, author_verified', { count: 'exact' });
        if (debouncedSearchTerm) {
          requestPromise = requestPromise
            .or(`title.ilike.%${debouncedSearchTerm}%,description.ilike.%${debouncedSearchTerm}%`);
        }
        requestPromise = requestPromise
          .order('created_at', { ascending: false })
          .range(from, to);
      }

      const { data, error, count } = await requestPromise;
      if (!isMounted.current) return;
      if (error) throw error;
      if (!data || data.length === 0) {
        if (reset) {
          setRecipes([]);
        }
        setHasMore(false);
      } else {
        const processedData = data.map(d => ({ ...d }));
        setRecipes(prev => reset ? processedData : [...prev, ...processedData]);
        setHasMore(count ? from + RECIPES_PER_PAGE < count : false);
      }
      retryCountRef.current = 0;
    } catch (error) {
      if (!isMounted.current) return;
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          setTimeout(() => {
            fetchSharedRecipes(reset, currentPage);
          }, 1000 * retryCountRef.current);
          return;
        }
      }
      console.error('Error fetching shared recipes:', error);
      setError(handleSupabaseError(error));
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [user, selectedTags, debouncedSearchTerm]);

  // Handle tag toggle
  const handleTagToggle = useCallback((tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
    setPage(0);
    setRecipes([]); // Clear existing recipes
    shouldRefetchRef.current = true;
  }, []);

  // Clear all selected tags
  const handleClearFilters = useCallback(() => {
    setSelectedTags([]);
    setPage(0);
    setRecipes([]); // Clear existing recipes
    shouldRefetchRef.current = true;
  }, []);

  // Clear search term
  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setPage(0);
    setRecipes([]); // Clear existing recipes
    shouldRefetchRef.current = true;
  }, []);

  // Initial data load and handle search/tag changes
  useEffect(() => {
    isMounted.current = true;
    if (user) {
      fetchTags();
      if (loading && recipes.length === 0) {
        fetchSharedRecipes(true, 0);
      }
    }
    return () => {
      isMounted.current = false;
    };
  }, [user, fetchTags, loading, recipes.length]);

  // Handle debouncedSearchTerm and selectedTags changes separately
  useEffect(() => {
    if (user && shouldRefetchRef.current) {
      shouldRefetchRef.current = false;
      fetchSharedRecipes(true, 0);
    }
  }, [user, debouncedSearchTerm, selectedTags, fetchSharedRecipes]);

  // Load more when page changes
  useEffect(() => {
    if (page > 0) {
      fetchSharedRecipes(false, page);
    }
  }, [page, fetchSharedRecipes]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [loadingMore, hasMore]);

  const lastRecipeElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loadingMore) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      });
      if (node) observer.current.observe(node);
    },
    [loadingMore, hasMore, loadMore]
  );

  const handleAddToMealPlan = useCallback((recipeId: string) => {
    setSelectedRecipe(recipeId);
    setShowMealPlanDialog(true);
  }, []);

  // Memoized recipe card component for better performance
  const RecipeCard = React.memo(({ recipe, isLast }: { recipe: Recipe, isLast: boolean }) => (
    <div
      ref={isLast ? lastRecipeElementRef : null}
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col"
    >
      <Link to={`/recipes/${recipe.id}`} className="flex-1">
        <div className="aspect-video overflow-hidden bg-gray-100">
          {recipe.image_url || recipe.image_data ? (
            <img
              src={recipe.image_data || recipe.image_url}
              alt={recipe.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ChefHat className="h-12 w-12 text-gray-400" />
            </div>
          )}
        </div>
        <div className="p-4 flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-1">{recipe.title}</h3>
          <p className="text-gray-600 text-sm line-clamp-2 mb-4">{recipe.description}</p>
          <div className="flex items-center justify-between mt-auto">
            <div className="text-sm text-gray-500 flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>{format(new Date(recipe.created_at), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex items-center space-x-2">
              {recipe.author_avatar ? (
                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100">
                  <img
                    src={recipe.author_avatar}
                    alt={recipe.author_name || 'Recipe author'}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                  <ChefHat className="h-3 w-3 text-gray-400" />
                </div>
              )}
              <span className="text-xs font-medium text-gray-700 truncate max-w-[100px]">
                {recipe.author_name || 'Anonymous Chef'}
              </span>
            </div>
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
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Fast Shared Recipes</h1>
        <p className="text-gray-600 mt-2">Quickly browse recipes shared by the community</p>
      </div>
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative rounded-md shadow-sm max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-10 py-2 rounded-md border-gray-300 focus:ring-primary-300 focus:border-primary-300"
            placeholder="Search recipes by title or description..."
          />
          {searchTerm && (
            <button
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {debouncedSearchTerm && (
          <p className="mt-2 text-sm text-gray-500">
            Showing results for "{debouncedSearchTerm}"
          </p>
        )}
      </div>
      {/* Tag filtering */}
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
                key={`tag-${tag.id}`}
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer transition-colors duration-200 ${
                  selectedTags.includes(tag.id)
                    ? 'bg-primary-100 text-primary-800 ring-2 ring-primary-300'
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
                <TagIcon className="h-4 w-4 mr-1" />
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
      {error && recipes.length === 0 && (
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          <div className="bg-red-50 p-6 rounded-lg">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <h2 className="mt-4 text-lg font-medium text-red-800">Unable to Load Recipes</h2>
            <p className="mt-2 text-red-600">{error}</p>
            <button
              onClick={() => {
                retryCountRef.current = 0;
                fetchSharedRecipes(true, 0);
                setPage(0);
              }}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </button>
          </div>
        </div>
      )}
      {recipes.length === 0 && !loading ? (
        <div className="text-center py-12">
          <ChefHat className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {debouncedSearchTerm || selectedTags.length > 0 ? 'No matching recipes found' : 'No shared recipes yet'}
          </h3>
          <p className="mt-2 text-gray-500">
            {debouncedSearchTerm || selectedTags.length > 0
              ? 'Try adjusting your search or filters'
              : 'Recipes shared with you or public recipes will appear here'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe, index) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              isLast={index === recipes.length - 1}
            />
          ))}
        </div>
      )}
      {loadingMore && (
        <div className="flex justify-center my-8">
          <Loader className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
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