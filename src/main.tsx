import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { validateEnv } from './lib/env';

// Validate environment variables before rendering
try {
  validateEnv();
} catch (error) {
  console.error('Environment validation failed:', error);
  
  // Render error page instead of normal app
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-700 mb-4">Configuration Error</h1>
          <p className="text-gray-700 mb-4">
            The application is missing required environment variables. Please check your 
            configuration and try again.
          </p>
          <div className="bg-gray-100 p-4 rounded mb-4 overflow-auto">
            <code className="text-sm text-red-600 whitespace-pre-wrap">
              {error instanceof Error ? error.message : 'Unknown error'}
            </code>
          </div>
          <p className="text-sm text-gray-600">
            Copy <code>.env.example</code> to <code>.env</code> and fill in your Supabase credentials.
          </p>
        </div>
      </div>
    );
    
    // Exit early
    throw error;
  }
}

// Normal app rendering
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);