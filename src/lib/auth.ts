import { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Constants for authentication
export const AUTH_STORAGE_KEY = 'recipe-keeper-auth';
export const SESSION_EXPIRY_MARGIN = 60 * 1000; // 1 minute before actual expiry

// Error types
export enum AuthErrorType {
  NETWORK = 'network',
  CREDENTIALS = 'credentials',
  SESSION_EXPIRED = 'session_expired',
  UNKNOWN = 'unknown'
}

// Custom error class
export class AuthenticationError extends Error {
  constructor(
    public type: AuthErrorType,
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Helper to check if error is network related
export const isNetworkError = (error: any): boolean => {
  return (
    error instanceof TypeError ||
    error?.message?.includes('network') ||
    error?.message?.includes('fetch') ||
    error?.name === 'AuthRetryableFetchError' ||
    error?.status === 0
  );
};

// Helper to format error messages
export const formatAuthError = (error: AuthError | Error | null): AuthenticationError => {
  if (!error) {
    return new AuthenticationError(
      AuthErrorType.UNKNOWN,
      'An unknown error occurred'
    );
  }

  if (isNetworkError(error)) {
    return new AuthenticationError(
      AuthErrorType.NETWORK,
      'Unable to connect. Please check your internet connection.'
    );
  }

  if ('status' in error && error.status === 401) {
    return new AuthenticationError(
      AuthErrorType.SESSION_EXPIRED,
      'Your session has expired. Please sign in again.'
    );
  }

  // Handle specific Supabase auth errors
  if ('name' in error && error.name === 'AuthApiError') {
    switch (error.message) {
      case 'Invalid login credentials':
        return new AuthenticationError(
          AuthErrorType.CREDENTIALS,
          'Invalid email or password'
        );
      case 'Email not confirmed':
        return new AuthenticationError(
          AuthErrorType.CREDENTIALS,
          'Please verify your email address'
        );
      default:
        return new AuthenticationError(
          AuthErrorType.UNKNOWN,
          error.message
        );
    }
  }

  return new AuthenticationError(
    AuthErrorType.UNKNOWN,
    error.message || 'An unexpected error occurred'
  );
};

// Helper to check if session is expired or about to expire
export const isSessionExpired = (session: Session | null): boolean => {
  if (!session?.expires_at) return true;
  const expiresAt = new Date(session.expires_at).getTime();
  return Date.now() + SESSION_EXPIRY_MARGIN >= expiresAt;
};

// Authentication service
class AuthService {
  private refreshPromise: Promise<void> | null = null;

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<User> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      if (!data.user) throw new Error('No user returned from sign in');

      return data.user;
    } catch (error) {
      throw formatAuthError(error as AuthError);
    }
  }

  // Sign up with email and password
  async signUp(email: string, password: string): Promise<void> {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) throw error;
    } catch (error) {
      throw formatAuthError(error as AuthError);
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      throw formatAuthError(error as AuthError);
    }
  }

  // Get current session with automatic refresh if needed
  async getSession(): Promise<Session | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session && isSessionExpired(session)) {
        return await this.refreshSession();
      }

      return session;
    } catch (error) {
      throw formatAuthError(error as AuthError);
    }
  }

  // Refresh session
  private async refreshSession(): Promise<Session | null> {
    // Ensure only one refresh happens at a time
    if (!this.refreshPromise) {
      this.refreshPromise = new Promise(async (resolve, reject) => {
        try {
          const { data: { session }, error } = await supabase.auth.refreshSession();
          if (error) throw error;
          resolve();
          return session;
        } catch (error) {
          reject(error);
          return null;
        } finally {
          this.refreshPromise = null;
        }
      });
    }
    await this.refreshPromise;
    return this.getSession();
  }

  // Update password
  async updatePassword(newPassword: string): Promise<void> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
    } catch (error) {
      throw formatAuthError(error as AuthError);
    }
  }

  // Reset password
  async resetPassword(email: string): Promise<void> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;
    } catch (error) {
      throw formatAuthError(error as AuthError);
    }
  }
}

export const authService = new AuthService();