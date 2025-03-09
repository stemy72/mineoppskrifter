import { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const MAX_RETRIES = 5;
const RETRY_DELAY = 1000;
const SESSION_CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const sessionCheckInterval = useRef<NodeJS.Timeout>();
  const retryTimeouts = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
      }
      retryTimeouts.current.forEach(clearTimeout);
      setError(null);
    };
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        let retryCount = 0;

        while (retryCount < MAX_RETRIES) {
          try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) throw sessionError;

            if (mounted.current) {
              setUser(session?.user ?? null);
              setLoading(false);
            }
            break;
          } catch (error) {
            if (error.name === 'AuthRetryableFetchError' && retryCount < MAX_RETRIES - 1) {
              retryCount++;
              const timeout = setTimeout(() => {
                initAuth();
              }, RETRY_DELAY * retryCount);
              retryTimeouts.current.push(timeout);
              continue;
            }
            throw error;
          }
        }
      } catch (error: any) {
        console.error('Auth initialization error:', error);
        if (mounted.current) {
          setError(error.message || 'Unable to connect to authentication service. Please try again.');
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted.current) {
        setUser(session?.user ?? null);
        
        // Clear and restart session check interval
        if (sessionCheckInterval.current) {
          clearInterval(sessionCheckInterval.current);
        }
        
        if (session) {
          sessionCheckInterval.current = setInterval(async () => {
            try {
              const { error: refreshError } = await supabase.auth.refreshSession();
              if (refreshError) throw refreshError;
            } catch (error) {
              console.error('Session refresh failed:', error);
              clearInterval(sessionCheckInterval.current);
            }
          }, SESSION_CHECK_INTERVAL);
        }
        
        setLoading(false);
      }
    });

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
      }
      retryTimeouts.current.forEach(clearTimeout);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      setError(error.message);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      let retryCount = 0;

      while (retryCount < MAX_RETRIES) {
        try {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: window.location.origin,
              data: {
                created_at: new Date().toISOString()
              }
            }
          });

          if (error) throw error;
          break;
        } catch (error: any) {
          if (error.name === 'AuthRetryableFetchError' && retryCount < MAX_RETRIES - 1) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
            continue;
          }
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      setLoading(true);
      let retryCount = 0;

      while (retryCount < MAX_RETRIES) {
        try {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
          break;
        } catch (error: any) {
          if (error.name === 'AuthRetryableFetchError' && retryCount < MAX_RETRIES - 1) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
            continue;
          }
          throw error;
        }
      }

      // Clear any cached data
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear session check interval
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
      }
    } catch (error: any) {
      console.error('Sign out error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      setError(null);
      let retryCount = 0;

      while (retryCount < MAX_RETRIES) {
        try {
          const { error } = await supabase.auth.refreshSession();
          if (error) throw error;
          break;
        } catch (error: any) {
          if (error.name === 'AuthRetryableFetchError' && retryCount < MAX_RETRIES - 1) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
            continue;
          }
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Session refresh error:', error);
      setError(error.message);
      throw error;
    }
  };

  return {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    refreshSession,
    isAuthenticated: !!user
  };
}