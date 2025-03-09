import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { addDays } from 'date-fns';
import { formatDate, formatDateRange, formatDayWithWeekday } from '../lib/date';
import {
  Calendar,
  ChefHat,
  Plus,
  Trash2,
  ShoppingCart,
  Check,
  AlertCircle,
  Save,
  ArrowLeft,
  ArrowRight,
  List,
  Edit2,
} from 'lucide-react';

interface Recipe {
  id: string;
  title: string;
  image_url: string;
}

interface MealPlan {
  id: string;
  start_date: string;
  days: number;
  recipes: {
    id: string;
    recipe_id: string;
    day_number: number;
    meal_type: string;
    recipe: Recipe;
  }[];
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = typeof MEAL_TYPES[number];

function MealPlanner() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [days, setDays] = useState<number>(7);
  const [startDate, setStartDate] = useState<string>(
    formatDate(new Date(), 'yyyy-MM-dd')
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRecipeList, setShowRecipeList] = useState(false);
  const [savedMealPlans, setSavedMealPlans] = useState<MealPlan[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      fetchRecipes();
      fetchSavedMealPlans();
      fetchCurrentMealPlan();
    } else {
      setLoading(false);
    }
  }, [user, authLoading]);

  const fetchSavedMealPlans = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('meal_plans')
        .select(`
          id,
          start_date,
          days,
          meal_plan_recipes (
            id,
            recipe_id,
            day_number,
            meal_type,
            recipe:recipes (
              id,
              title,
              image_url
            )
          )
        `)
        .eq('user_id', user.id)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setSavedMealPlans(data || []);
    } catch (error) {
      console.error('Error fetching saved meal plans:', error);
    }
  };

  const fetchRecipes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title, image_url')
        .eq('user_id', user.id);

      if (error) throw error;
      setRecipes(data || []);
    } catch (error) {
      console.error('Error fetching recipes:', error);
    }
  };

  const fetchCurrentMealPlan = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('meal_plans')
        .select(`
          id,
          start_date,
          days,
          meal_plan_recipes (
            id,
            recipe_id,
            day_number,
            meal_type,
            recipe:recipes (
              id,
              title,
              image_url
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setMealPlan({
          ...data,
          recipes: data.meal_plan_recipes || []
        });
      } else {
        setMealPlan(null);
      }
    } catch (error) {
      console.error('Error fetching meal plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const createMealPlan = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('meal_plans')
        .insert([
          {
            user_id: user.id,
            start_date: startDate,
            days: days,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      setMealPlan({ ...data, recipes: [] });
      setSuccess('Meal plan created successfully');
      fetchSavedMealPlans();
    } catch (error) {
      console.error('Error creating meal plan:', error);
      setError('Failed to create meal plan');
    }
  };

  const addRecipeToMealPlan = async () => {
    if (!mealPlan || !selectedRecipe || !user) return;

    try {
      const existingRecipe = mealPlan.recipes.find(
        r => r.day_number === selectedDay && r.meal_type === selectedMealType
      );

      if (existingRecipe) {
        const confirmReplace = window.confirm(
          `There's already a recipe scheduled for ${selectedMealType} on day ${selectedDay}. Would you like to replace it?`
        );

        if (confirmReplace) {
          const { error: deleteError } = await supabase
            .from('meal_plan_recipes')
            .delete()
            .eq('id', existingRecipe.id);

          if (deleteError) throw deleteError;
        } else {
          return;
        }
      }

      const { error } = await supabase.from('meal_plan_recipes').insert([
        {
          meal_plan_id: mealPlan.id,
          recipe_id: selectedRecipe,
          day_number: selectedDay,
          meal_type: selectedMealType,
        },
      ]);

      if (error) throw error;

      fetchCurrentMealPlan();
      setSelectedRecipe('');
      setSuccess('Recipe added to meal plan');
      setShowRecipeList(false);
    } catch (error) {
      console.error('Error adding recipe to meal plan:', error);
      setError('Failed to add recipe to meal plan. Please try a different day or meal type.');
    }
  };

  const removeRecipeFromMealPlan = async (recipeId: string) => {
    if (!mealPlan || !user) return;

    try {
      const { error } = await supabase
        .from('meal_plan_recipes')
        .delete()
        .eq('id', recipeId);

      if (error) throw error;
      fetchCurrentMealPlan();
      setSuccess('Recipe removed from meal plan');
    } catch (error) {
      console.error('Error removing recipe from meal plan:', error);
      setError('Failed to remove recipe from meal plan');
    }
  };

  const loadSavedMealPlan = async (planId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('meal_plans')
        .select(`
          id,
          start_date,
          days,
          meal_plan_recipes (
            id,
            recipe_id,
            day_number,
            meal_type,
            recipe:recipes (
              id,
              title,
              image_url
            )
          )
        `)
        .eq('id', planId)
        .single();

      if (error) throw error;
      setMealPlan({
        ...data,
        recipes: data.meal_plan_recipes || []
      });
      setSuccess('Meal plan loaded successfully');
    } catch (error) {
      console.error('Error loading meal plan:', error);
      setError('Failed to load meal plan');
    }
  };

  const generateGroceryList = async () => {
    if (!mealPlan || !user) return;

    try {
      const endDate = addDays(new Date(mealPlan.start_date), mealPlan.days - 1);
      const listName = `Grocery List for ${formatDateRange(mealPlan.start_date, endDate)}`;
      
      const { data: groceryList, error: groceryListError } = await supabase
        .from('grocery_lists')
        .insert([
          {
            meal_plan_id: mealPlan.id,
            user_id: user.id,
            start_date: mealPlan.start_date,
            end_date: formatDate(endDate, 'yyyy-MM-dd'),
            name: listName
          },
        ])
        .select()
        .single();

      if (groceryListError) throw groceryListError;

      const { data: ingredients, error: ingredientsError } = await supabase
        .from('ingredients')
        .select('name, amount, unit')
        .in(
          'recipe_id',
          mealPlan.recipes.map((r) => r.recipe_id)
        );

      if (ingredientsError) throw ingredientsError;

      const consolidatedIngredients = ingredients?.reduce((acc, curr) => {
        const key = `${curr.name}-${curr.unit}`;
        if (!acc[key]) {
          acc[key] = { ...curr };
        } else {
          acc[key].amount = (acc[key].amount || 0) + (curr.amount || 0);
        }
        return acc;
      }, {} as Record<string, any>);

      if (consolidatedIngredients) {
        const groceryItems = Object.values(consolidatedIngredients).map(
          (item: any) => ({
            grocery_list_id: groceryList.id,
            name: item.name,
            amount: item.amount,
            unit: item.unit,
          })
        );

        const { error: itemsError } = await supabase
          .from('grocery_items')
          .insert(groceryItems);

        if (itemsError) throw itemsError;
      }

      navigate(`/grocery-list/${groceryList.id}`);
    } catch (error) {
      console.error('Error generating grocery list:', error);
      setError('Failed to generate grocery list');
    }
  };

  const deleteMealPlan = async (planId: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this meal plan?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('meal_plans')
        .delete()
        .eq('id', planId)
        .eq('user_id', user.id);

      if (error) throw error;

      // If we're deleting the current plan, clear it
      if (mealPlan && mealPlan.id === planId) {
        setMealPlan(null);
      }
      
      // Refresh the saved meal plans list
      fetchSavedMealPlans();
      setSuccess('Meal plan deleted successfully');
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      setError('Failed to delete meal plan');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
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
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main content */}
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Meal Planner</h1>
            {mealPlan && (
              <button
                onClick={generateGroceryList}
                className="w-full sm:w-auto flex items-center justify-center px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                Generate Grocery List
              </button>
            )}
          </div>

          {(error || success) && (
            <div
              className={`mb-6 p-4 ${
                error
                  ? 'bg-red-100 border-red-400 text-red-700'
                  : 'bg-green-100 border-green-400 text-green-700'
              } rounded-lg flex items-center shadow-sm`}
            >
              {error ? (
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              ) : (
                <Check className="h-5 w-5 mr-2 flex-shrink-0" />
              )}
              {error || success}
            </div>
          )}

          {!mealPlan ? (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-6">Create New Meal Plan</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Days
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value))}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={createMealPlan}
                  className="w-full flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Calendar className="h-5 w-5 mr-2" />
                  Create Meal Plan
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {showRecipeList && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">Add Recipe to Meal Plan</h2>
                    <button
                      onClick={() => setShowRecipeList(false)}
                      className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Day
                      </label>
                      <select
                        value={selectedDay}
                        onChange={(e) => setSelectedDay(parseInt(e.target.value))}
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        {Array.from({ length: mealPlan.days }, (_, i) => i + 1).map(
                          (day) => (
                            <option key={day} value={day}>
                              Day {day} -{' '}
                              {formatDate(addDays(new Date(mealPlan.start_date), day - 1), 'MMM d')}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Meal Type
                      </label>
                      <select
                        value={selectedMealType}
                        onChange={(e) => setSelectedMealType(e.target.value as MealType)}
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        {MEAL_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Recipe
                      </label>
                      <select
                        value={selectedRecipe}
                        onChange={(e) => setSelectedRecipe(e.target.value)}
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        <option value="">Select a recipe</option>
                        {recipes.map((recipe) => (
                          <option key={recipe.id} value={recipe.id}>
                            {recipe.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={addRecipeToMealPlan}
                        disabled={!selectedRecipe}
                        className="w-full flex items-center justify-center px-4 py-2.5 rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-5 w-5 mr-2" />
                        Add Recipe
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-xl font-semibold">
                    Meal Plan for{' '}
                    {formatDateRange(mealPlan.start_date, addDays(new Date(mealPlan.start_date), mealPlan.days - 1))}
                  </h2>
                  <button
                    onClick={() => setShowRecipeList(!showRecipeList)}
                    className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Recipe
                  </button>
                </div>
                <div className="divide-y divide-gray-200">
                  {Array.from({ length: mealPlan.days }, (_, i) => i + 1).map(
                    (day) => (
                      <div key={day} className="p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                          Day {day} -{' '}
                          {formatDayWithWeekday(addDays(new Date(mealPlan.start_date), day - 1))}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {MEAL_TYPES.map((mealType) => (
                            <div
                              key={mealType}
                              className="bg-gray-50 rounded-lg p-4"
                            >
                              <h4 className="font-medium text-gray-700 mb-3">
                                {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                              </h4>
                              {mealPlan.recipes
                                .filter(
                                  (r) =>
                                    r.day_number === day && r.meal_type === mealType
                                )
                                .map((mealRecipe) => (
                                  <div
                                    key={mealRecipe.id}
                                    className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                                  >
                                    <Link
                                      to={`/recipes/${mealRecipe.recipe_id}`}
                                      className="flex items-center flex-1 min-w-0"
                                    >
                                      {mealRecipe.recipe.image_url ? (
                                        <img
                                          src={mealRecipe.recipe.image_url}
                                          alt={mealRecipe.recipe.title}
                                          className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                                        />
                                      ) : (
                                        <ChefHat className="h-10 w-10 text-gray-400 flex-shrink-0" />
                                      )}
                                      <span className="ml-3 text-sm font-medium text-gray-900 truncate">
                                        {mealRecipe.recipe.title}
                                      </span>
                                    </Link>
                                    <button
                                      onClick={() =>
                                        removeRecipeFromMealPlan(mealRecipe.id)
                                      }
                                      className="ml-2 p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Saved meal plans sidebar */}
        <div className="lg:w-80">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <List className="h-5 w-5 mr-2" />
              Saved Meal Plans
            </h2>
            <div className="space-y-3">
              {savedMealPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative group p-4 rounded-lg border ${
                    mealPlan?.id === plan.id
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-600 hover:bg-gray-50'
                  } transition-all`}
                >
                  <div className="pr-8">
                    <h3 className="font-medium text-gray-900">
                      {formatDateRange(plan.start_date, addDays(new Date(plan.start_date), plan.days - 1))}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {plan.days} days, {plan.recipes?.length || 0} recipes
                    </p>
                  </div>
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => loadSavedMealPlan(plan.id)}
                      className="p-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-full"
                      title="Load plan"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteMealPlan(plan.id)}
                      className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full"
                      title="Delete plan"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {savedMealPlans.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  <Calendar className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p>No saved meal plans yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MealPlanner;