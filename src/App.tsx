import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { CookingPot, BookOpen, PlusCircle, LogIn, Users, Calendar, Menu, X, LogOut, Loader, Upload, User, Zap } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import Auth from './components/Auth';
import RecipeForm from './components/RecipeForm';
import RecipeImport from './components/RecipeImport';
import RecipeDetail from './components/RecipeDetail';
import RecipeList from './components/RecipeList';
import SharedRecipes from './components/SharedRecipes';
import FastSharedRecipes from './components/FastSharedRecipes';
import MealPlanner from './components/MealPlanner';
import GroceryList from './components/GroceryList';
import UserProfile from './components/UserProfile';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';

// Loading component
const PageLoader = () => (
  <div className="flex justify-center items-center min-h-[50vh]">
    <Loader className="h-12 w-12 text-primary-300 animate-spin" />
  </div>
);

// Protected Route Component
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { user, signOut, loading: authLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const location = useLocation();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    closeMobileMenu();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2" onClick={closeMobileMenu}>
                <CookingPot className="h-6 w-6 text-primary-300" />
                <span className="font-bold text-xl text-gray-900">RecipeKeeper</span>
              </Link>

              {/* Desktop Navigation */}
              {user && (
                <div className="hidden md:flex items-center space-x-4 ml-8">
                  <Link
                    to="/recipes"
                    className={`flex items-center space-x-1 ${
                      location.pathname === '/recipes'
                        ? 'text-primary-300'
                        : 'text-gray-700 hover:text-primary-300'
                    }`}
                  >
                    <BookOpen className="h-5 w-5" />
                    <span>My Recipes</span>
                  </Link>
                  <Link
                    to="/shared-recipes"
                    className={`flex items-center space-x-1 ${
                      location.pathname === '/shared-recipes'
                        ? 'text-primary-300'
                        : 'text-gray-700 hover:text-primary-300'
                    }`}
                  >
                    <Users className="h-5 w-5" />
                    <span>Shared Recipes</span>
                  </Link>
                  <Link
                    to="/fast-shared"
                    className={`flex items-center space-x-1 ${
                      location.pathname === '/fast-shared'
                        ? 'text-primary-300'
                        : 'text-gray-700 hover:text-primary-300'
                    }`}
                  >
                    <Zap className="h-5 w-5" />
                    <span>Fast Shared</span>
                  </Link>
                  <Link
                    to="/meal-planner"
                    className={`flex items-center space-x-1 ${
                      location.pathname === '/meal-planner'
                        ? 'text-primary-300'
                        : 'text-gray-700 hover:text-primary-300'
                    }`}
                  >
                    <Calendar className="h-5 w-5" />
                    <span>Meal Planner</span>
                  </Link>
                  <Link
                    to="/recipes/new"
                    className={`flex items-center space-x-1 ${
                      location.pathname === '/recipes/new'
                        ? 'text-primary-300'
                        : 'text-gray-700 hover:text-primary-300'
                    }`}
                  >
                    <PlusCircle className="h-5 w-5" />
                    <span>Add Recipe</span>
                  </Link>
                  <Link
                    to="/recipes/import"
                    className={`flex items-center space-x-1 ${
                      location.pathname === '/recipes/import'
                        ? 'text-primary-300'
                        : 'text-gray-700 hover:text-primary-300'
                    }`}
                  >
                    <Upload className="h-5 w-5" />
                    <span>Import Recipe</span>
                  </Link>
                  <Link
                    to="/profile"
                    className={`flex items-center space-x-1 ${
                      location.pathname === '/profile'
                        ? 'text-primary-300'
                        : 'text-gray-700 hover:text-primary-300'
                    }`}
                  >
                    <User className="h-5 w-5" />
                    <span>Profile</span>
                  </Link>
                </div>
              )}
            </div>

            <div className="flex items-center">
              {authLoading ? (
                <div className="flex items-center px-4 py-2">
                  <Loader className="h-5 w-5 text-primary-300 animate-spin" />
                </div>
              ) : user ? (
                <div className="flex items-center space-x-4">
                  {/* Mobile menu button */}
                  <button
                    onClick={toggleMobileMenu}
                    className="md:hidden p-2 text-gray-700 hover:text-primary-300"
                  >
                    {mobileMenuOpen ? (
                      <X className="h-6 w-6" />
                    ) : (
                      <Menu className="h-6 w-6" />
                    )}
                  </button>

                  <button
                    onClick={handleSignOut}
                    className="p-2 rounded-full text-red-600 hover:text-red-700 hover:bg-gray-100 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  state={{ from: location.pathname }}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-accent-400 hover:bg-accent-500"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Navigation */}
          {user && mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 py-2">
              <div className="space-y-1">
                <Link
                  to="/recipes"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    location.pathname === '/recipes'
                      ? 'text-primary-300 bg-primary-50'
                      : 'text-gray-700 hover:text-primary-300 hover:bg-gray-50'
                  }`}
                  onClick={closeMobileMenu}
                >
                  <div className="flex items-center space-x-2">
                    <BookOpen className="h-5 w-5" />
                    <span>My Recipes</span>
                  </div>
                </Link>
                <Link
                  to="/shared-recipes"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    location.pathname === '/shared-recipes'
                      ? 'text-primary-300 bg-primary-50'
                      : 'text-gray-700 hover:text-primary-300 hover:bg-gray-50'
                  }`}
                  onClick={closeMobileMenu}
                >
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>Shared Recipes</span>
                  </div>
                </Link>
                <Link
                  to="/fast-shared"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    location.pathname === '/fast-shared'
                      ? 'text-primary-300 bg-primary-50'
                      : 'text-gray-700 hover:text-primary-300 hover:bg-gray-50'
                  }`}
                  onClick={closeMobileMenu}
                >
                  <div className="flex items-center space-x-2">
                    <Zap className="h-5 w-5" />
                    <span>Fast Shared</span>
                  </div>
                </Link>
                <Link
                  to="/meal-planner"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    location.pathname === '/meal-planner'
                      ? 'text-primary-300 bg-primary-50'
                      : 'text-gray-700 hover:text-primary-300 hover:bg-gray-50'
                  }`}
                  onClick={closeMobileMenu}
                >
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <span>Meal Planner</span>
                  </div>
                </Link>
                <Link
                  to="/recipes/new"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    location.pathname === '/recipes/new'
                      ? 'text-primary-300 bg-primary-50'
                      : 'text-gray-700 hover:text-primary-300 hover:bg-gray-50'
                  }`}
                  onClick={closeMobileMenu}
                >
                  <div className="flex items-center space-x-2">
                    <PlusCircle className="h-5 w-5" />
                    <span>Add Recipe</span>
                  </div>
                </Link>
                <Link
                  to="/recipes/import"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    location.pathname === '/recipes/import'
                      ? 'text-primary-300 bg-primary-50'
                      : 'text-gray-700 hover:text-primary-300 hover:bg-gray-50'
                  }`}
                  onClick={closeMobileMenu}
                >
                  <div className="flex items-center space-x-2">
                    <Upload className="h-5 w-5" />
                    <span>Import Recipe</span>
                  </div>
                </Link>
                <Link
                  to="/profile"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    location.pathname === '/profile'
                      ? 'text-primary-300 bg-primary-50'
                      : 'text-gray-700 hover:text-primary-300 hover:bg-gray-50'
                  }`}
                  onClick={closeMobileMenu}
                >
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span>Profile</span>
                  </div>
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Auth />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            
            {/* Protected Routes */}
            <Route path="/" element={<RequireAuth><Navigate to="/recipes" replace /></RequireAuth>} />
            
            {/* Recipe Routes - Order matters! More specific routes first */}
            <Route path="/recipes/new" element={<RequireAuth><RecipeForm key="new-recipe" /></RequireAuth>} />
            <Route path="/recipes/import" element={<RequireAuth><RecipeImport /></RequireAuth>} />
            <Route path="/recipes/edit/:id" element={<RequireAuth><RecipeForm key="edit-recipe" /></RequireAuth>} />
            <Route path="/recipes/:id" element={<RequireAuth><RecipeDetail /></RequireAuth>} />
            <Route path="/recipes" element={<RequireAuth><RecipeList /></RequireAuth>} />
            
            {/* Other Protected Routes */}
            <Route path="/shared-recipes" element={<RequireAuth><SharedRecipes /></RequireAuth>} />
            <Route path="/fast-shared" element={<RequireAuth><FastSharedRecipes /></RequireAuth>} />
            <Route path="/meal-planner" element={<RequireAuth><MealPlanner /></RequireAuth>} />
            <Route path="/grocery-list/:id" element={<RequireAuth><GroceryList /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><UserProfile /></RequireAuth>} />
          </Routes>
        </div>
      </main>

      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center text-sm text-gray-500">
            © {new Date().getFullYear()} RecipeKeeper. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}