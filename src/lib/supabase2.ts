// supabase.ts
import { createClient } from '@supabase/supabase-js';

// Environment variable validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Initialize Supabase client with optimized settings
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: { 'x-application-name': 'recipekeeper' },
  },
});

// Types for better type safety
interface Recipe {
  id: string;
  title: string;
  description: string;
  image_url: string;
  created_at: string;
  recipe_tags?: { tag_id: string }[];
}

interface Tag {
  id: string;
  name: string;
}

/**
 * Fetch recipes with pagination, tag filtering, and search
 * @param userId - The authenticated user's ID
 * @param page - Current page number (0-based)
 * @param pageSize - Number of recipes per page
 * @param selectedTags - Array of tag IDs to filter by
 * @param searchQuery - Search term for recipe titles
 * @returns Object containing recipes and total count
 */
export async function fetchRecipes(
  userId: string,
  page: number,
  pageSize: number,
  selectedTags: string[] = [],
  searchQuery: string = ''
): Promise<{ data: Recipe[]; count: number }> {
  try {
    let query = supabase
      .from('recipes')
      .select(
        `
          id,
          title,
          description,
          image_url,
          created_at,
          recipe_tags!left(tag_id)
        `,
        { count: 'exact' }
      )
      .eq('user_id', userId) // Security: Restrict to user's recipes
      .order('created_at', { ascending: false });

    // Apply tag filtering
    if (selectedTags.length > 0) {
      const { data: taggedRecipes, error: tagError } = await supabase
        .from('recipe_tags')
        .select('recipe_id')
        .in('tag_id', selectedTags);

      if (tagError) throw new Error(`Tag filter error: ${tagError.message}`);

      if (!taggedRecipes?.length) {
        return { data: [], count: 0 }; // No matches, return early
      }

      const matchingIds = Array.from(new Set(taggedRecipes.map((r) => r.recipe_id)));
      query = query.in('id', matchingIds);
    }

    // Apply search filtering
    if (searchQuery.trim()) {
      query = query.ilike('title', `%${searchQuery.trim()}%`);
    }

    // Pagination
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await query.range(from, to);

    if (error) throw new Error(`Query error: ${error.message}`);

    return { data: (data || []) as Recipe[], count: count || 0 };
  } catch (error) {
    console.error('Error fetching recipes:', error);
    throw error; // Let the caller handle the error
  }
}

/**
 * Fetch all tags for a user
 * @param userId - The authenticated user's ID
 * @returns Array of tags
 */
export async function fetchTags(userId: string): Promise<Tag[]> {
  try {
    const { data, error } = await supabase
      .from('tags')
      .select('id, name')
      .eq('user_id', userId) // Security: Restrict to user's tags
      .order('name');

    if (error) throw new Error(`Tag fetch error: ${error.message}`);
    return (data || []) as Tag[];
  } catch (error) {
    console.error('Error fetching tags:', error);
    throw error; // Let the caller handle the error
  }
}

/**
 * Custom error handler for Supabase errors
 * @param error - The error object from Supabase
 * @returns User-friendly error message
 */
export function handleSupabaseError(error: any): string {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return 'Network error: Please check your internet connection.';
  }
  if (error?.code === '42501') {
    return 'Permission denied: You lack access to this resource.';
  }
  if (error?.code === '429') {
    return 'Too many requests: Please wait and try again.';
  }
  return error?.message || 'An unexpected error occurred. Please try again.';
}