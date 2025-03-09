import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env';

// Environment variable validation
const supabaseUrl = getEnv('VITE_SUPABASE_URL', true);
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY', true);

// Constants for retry and timeout configuration
const MIN_RETRY_DELAY = 1000;     // 1 second initial retry
const MAX_RETRY_DELAY = 10000;    // 10 seconds maximum retry delay
const MAX_RETRIES = 5;            // Maximum number of retries
const REQUEST_TIMEOUT = 30000;    // 30 second timeout for slower connections

// Initialize Supabase client with optimized settings
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'recipe-keeper-auth',
    flowType: 'pkce',
    debug: import.meta.env.DEV,
    retryAttempts: MAX_RETRIES,
    retryInterval: (attempt) => {
      // Exponential backoff with jitter
      const delay = Math.min(
        MIN_RETRY_DELAY * Math.pow(2, attempt) + Math.random() * 1000,
        MAX_RETRY_DELAY
      );
      console.debug(`Auth retry attempt ${attempt + 1} with delay ${delay}ms`);
      return delay;
    }
  },
  global: {
    headers: { 
      'x-application-name': 'recipekeeper',
      'apikey': supabaseAnonKey,
      'Cache-Control': 'no-cache'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  // Add request timeout and retry logic
  fetch: (url, options) => {
    const fetchWithTimeout = (attempt = 0): Promise<Response> => {
      return new Promise((resolve, reject) => {
        const controller = new AbortController();
        const signal = controller.signal;

        // Add query hints and timeouts
        const headers = {
          ...options?.headers,
          'Prefer': options?.method === 'GET' 
            ? 'count=exact,plan=parallel_append'
            : 'count=exact'
        };

        const timeoutId = setTimeout(() => {
          controller.abort();
          if (attempt < MAX_RETRIES - 1) {
            console.debug(`Request timeout, retrying (${attempt + 1}/${MAX_RETRIES})`);
            const nextAttempt = fetchWithTimeout(attempt + 1);
            resolve(nextAttempt);
          } else {
            reject(new Error('Request timed out after all retries'));
          }
        }, REQUEST_TIMEOUT);

        fetch(url, { 
          ...options, 
          signal,
          headers,
          // Add keepalive for better connection handling
          keepalive: true,
          // Add cache control
          cache: 'no-cache'
        })
          .then(resolve)
          .catch((error) => {
            if (error.name === 'AbortError' || error.name === 'TypeError') {
              if (attempt < MAX_RETRIES - 1) {
                console.debug(`Network error, retrying (${attempt + 1}/${MAX_RETRIES})`);
                const nextAttempt = fetchWithTimeout(attempt + 1);
                resolve(nextAttempt);
              } else {
                reject(error);
              }
            } else {
              reject(error);
            }
          })
          .finally(() => clearTimeout(timeoutId));
      });
    };

    return fetchWithTimeout();
  }
});

// Enhanced error handling
export const handleSupabaseError = (error: any): string => {
  console.error('Supabase error:', error);
  
  // Network and timeout errors
  if (
    error instanceof TypeError && error.message === 'Failed to fetch' ||
    error?.message?.includes('timed out') ||
    error?.message?.includes('abort')
  ) {
    return 'Connection lost. Please check your internet connection and try again.';
  }
  
  // Auth retryable errors
  if (error?.name === 'AuthRetryableFetchError') {
    return 'Having trouble connecting to the authentication service. Please try again.';
  }
  
  // Recipe import specific errors
  if (error?.message?.includes('Recipe title is required')) {
    return 'Please enter a recipe title';
  }
  if (error?.message?.includes('Recipe instructions are required')) {
    return 'Please enter cooking instructions';
  }
  if (error?.message?.includes('A recipe with this title already exists')) {
    return 'You already have a recipe with this title';
  }
  if (error?.message?.includes('Invalid tag IDs provided')) {
    return 'One or more selected tags are invalid';
  }
  
  // Timeout errors
  if (error?.code === '57014' || error?.message?.includes('timeout')) {
    return 'The request timed out. Please try again with fewer filters or a smaller page size.';
  }
  
  // Authentication errors
  if (error?.code?.startsWith('auth/')) {
    return 'Your session has expired. Please sign in again.';
  }

  // Permission errors
  if (error?.code === '42501') {
    return 'You do not have permission to access this resource.';
  }

  // Storage errors
  if (error?.error === 'Invalid file type') {
    return 'Only JPG, PNG, GIF, and WebP images are allowed';
  }
  if (error?.error === 'File size too large') {
    return 'Image size must be less than 5MB';
  }
  if (error?.statusCode === 413) {
    return 'Image size is too large. Please choose a smaller file.';
  }
  
  // Not found errors
  if (error?.code === 'PGRST116') {
    return 'The requested resource was not found.';
  }

  // Rate limiting
  if (error?.code === '429') {
    return 'Too many requests. Please wait a few seconds before trying again.';
  }

  // Database errors
  if (error?.code?.startsWith('23')) {
    return 'A database error occurred. Please try refreshing the page.';
  }

  // Generic error with suggestion
  return error?.message || 'Unable to complete the request. Please try again.';
};