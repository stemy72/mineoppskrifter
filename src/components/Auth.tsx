import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Loader, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { handleSupabaseError } from '../lib/supabase';

// Email input component
const EmailInput = ({ email, setEmail, disabled }: { 
  email: string; 
  setEmail: (value: string) => void;
  disabled: boolean;
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700">Email</label>
    <div className="mt-1 relative">
      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="pl-10 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        required
        disabled={disabled}
        aria-label="Email address"
      />
    </div>
  </div>
);

// Password input component
const PasswordInput = ({ 
  password, 
  setPassword, 
  showPassword, 
  setShowPassword,
  disabled
}: {
  password: string;
  setPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  disabled: boolean;
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700">Password</label>
    <div className="mt-1 relative">
      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
      <input
        type={showPassword ? 'text' : 'password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="pl-10 pr-10 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        required
        minLength={6}
        disabled={disabled}
        aria-label="Password"
      />
      <button 
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-500 focus:outline-none"
        disabled={disabled}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? 'Hide' : 'Show'}
      </button>
    </div>
    <p className="mt-1 text-sm text-gray-500">
      Minimum 6 characters
    </p>
  </div>
);

// Status message component
const StatusMessage = ({ error, success }: { error?: string | null; success?: string | null }) => {
  if (!error && !success) return null;

  const isError = !!error;
  return (
    <div className={`mb-4 p-3 ${isError ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-700'} rounded-md flex items-center`}>
      {isError ? (
        <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
      ) : (
        <Check className="h-5 w-5 mr-2 flex-shrink-0" />
      )}
      <span className="text-sm">{error || success}</span>
    </div>
  );
};

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp } = useAuth();

  // Get redirect path from location state
  const from = location.state?.from || '/recipes';

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);

    try {
      // Validate input
      if (!email.trim() || !password.trim()) {
        throw new Error('Please enter both email and password');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      if (!email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      // Attempt authentication with retry logic
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          if (isSignUp) {
            await signUp(email, password);
            setSuccess('Account created successfully! You can now sign in.');
          } else {
            await signIn(email, password);
          }
          break;
        } catch (error: any) {
          if (error.name === 'AuthRetryableFetchError' && retryCount < maxRetries - 1) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            continue;
          }
          throw error;
        }
      }

      // Clear form on success
      setEmail('');
      setPassword('');
    } catch (error: any) {
      console.error('Auth error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          {isSignUp ? 'Create an Account' : 'Welcome Back'}
        </h2>

        <StatusMessage error={error} success={success} />

        <form onSubmit={handleSubmit} className="space-y-6">
          <EmailInput 
            email={email} 
            setEmail={setEmail} 
            disabled={loading} 
          />

          <PasswordInput 
            password={password} 
            setPassword={setPassword} 
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            disabled={loading}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? (
              <Loader className="animate-spin h-5 w-5" />
            ) : (
              isSignUp ? 'Sign Up' : 'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setSuccess(null);
            }}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}