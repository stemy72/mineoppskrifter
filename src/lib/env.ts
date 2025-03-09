/**
 * Environment variable helper functions
 * 
 * This module provides type-safe access to environment variables
 * and ensures they are properly validated at runtime.
 */

// Define the required environment variables
const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY'
];

// Define optional environment variables with their defaults
const OPTIONAL_ENV_VARS: Record<string, string | undefined> = {
  'VITE_APP_URL': window.location.origin,
  'VITE_GOOGLE_API_KEY': undefined,
  'VITE_OPENAI_API_KEY': undefined
};

/**
 * Validates that all required environment variables are defined
 * @throws Error if any required variable is missing
 */
export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(name => !import.meta.env[name]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Please check your .env file or deployment configuration.'
    );
  }
}

/**
 * Gets an environment variable with type safety
 * @param name - The name of the environment variable
 * @param required - Whether the variable is required
 * @returns The value of the environment variable
 * @throws Error if a required variable is missing
 */
export function getEnv(name: string, required = false): string {
  const value = import.meta.env[name] as string | undefined;
  
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  
  if (!value && name in OPTIONAL_ENV_VARS) {
    return OPTIONAL_ENV_VARS[name] || '';
  }
  
  return value || '';
}

/**
 * Checks if an environment variable is defined
 * @param name - The name of the environment variable
 * @returns Whether the variable is defined
 */
export function hasEnv(name: string): boolean {
  return !!import.meta.env[name];
}

// Check required environment variables on module initialization
try {
  validateEnv();
} catch (error) {
  console.error('Environment validation error:', error);
}