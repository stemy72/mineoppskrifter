import React, { useState, useEffect } from 'react';
import { addDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Calendar, X, Plus, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatDateRange } from '../lib/date';

interface MealPlan {
  id: string;
  start_date: string;
  days: number;
}

interface MealPlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  recipeId: string;
  onSuccess?: () => void;
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = typeof MEAL_TYPES[number];

export default function MealPlanDialog({ isOpen, onClose, recipeId, onSuccess }: MealPlanDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('dinner');
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [newPlan, setNewPlan] = useState({
    startDate: formatDate(new Date(), 'yyyy-MM-dd'),
    days: 7
  });

  useEffect(() => {
    if (isOpen && user) {
      fetchMealPlans();
    }
  }, [isOpen, user]);

  const fetchMealPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', user?.id)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setMealPlans(data || []);
      if (data && data.length > 0) {
        setSelectedPlan(data[0].id);
      } else {
        setShowNewPlanForm(true);
      }
    } catch (error) {
      console.error('Error fetching meal plans:', error);
      setError('Failed to load meal plans');
    }
  };

  const createMealPlan = async () => {
    try {
      const { data, error } = await supabase
        .from('meal_plans')
        .insert([
          {
            user_id: user?.id,
            start_date: newPlan.startDate,
            days: newPlan.days,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      
      await fetchMealPlans();
      setSelectedPlan(data.id);
      setShowNewPlanForm(false);
      setSuccess('New meal plan created');
    } catch (error) {
      console.error('Error creating meal plan:', error);
      setError('Failed to create meal plan');
    }
  };

  const addRecipeToMealPlan = async () => {
    if (!selectedPlan) return;

    try {
      setLoading(true);
      setError(null);

      // Check if there's already a recipe for this day/meal type
      const { data: existingRecipes, error: checkError } = await supabase
        .from('meal_plan_recipes')
        .select('id')
        .eq('meal_plan_id', selectedPlan)
        .eq('day_number', selectedDay)
        .eq('meal_type', selectedMealType);

      if (checkError) throw checkError;

      if (existingRecipes && existingRecipes.length > 0) {
        const confirmReplace = window.confirm(
          `There's already a recipe scheduled for ${selectedMealType} on day ${selectedDay}. Would you like to replace it?`
        );

        if (confirmReplace) {
          const { error: deleteError } = await supabase
            .from('meal_plan_recipes')
            .delete()
            .eq('id', existingRecipes[0].id);

          if (deleteError) throw deleteError;
        } else {
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase
        .from('meal_plan_recipes')
        .insert([
          {
            meal_plan_id: selectedPlan,
            recipe_id: recipeId,
            day_number: selectedDay,
            meal_type: selectedMealType,
          },
        ]);

      if (error) throw error;

      setSuccess('Recipe added to meal plan');
      if (onSuccess) onSuccess();
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error('Error adding recipe to meal plan:', error);
      setError('Failed to add recipe to meal plan');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Add to Meal Plan
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {(error || success) && (
          <div
            className={`mb-4 p-3 rounded flex items-center ${
              error
                ? 'bg-red-100 text-red-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {error ? (
              <AlertCircle className="h-5 w-5 mr-2" />
            ) : (
              <Check className="h-5 w-5 mr-2" />
            )}
            {error || success}
          </div>
        )}

        <div className="space-y-4">
          {!showNewPlanForm ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Meal Plan
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value)}
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    {mealPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {formatDate(plan.start_date, 'MMM d')} -{' '}
                        {formatDateRange(plan.start_date, addDays(new Date(plan.start_date), plan.days - 1))}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowNewPlanForm(true)}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {selectedPlan && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Day
                    </label>
                    <select
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(parseInt(e.target.value))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      {Array.from(
                        { length: mealPlans.find(p => p.id === selectedPlan)?.days || 7 },
                        (_, i) => i + 1
                      ).map((day) => (
                        <option key={day} value={day}>
                          Day {day} -{' '}
                          {formatDate(
                            addDays(
                              new Date(mealPlans.find(p => p.id === selectedPlan)?.start_date || ''),
                              day - 1
                            ),
                            'EEE, MMM d'
                          )}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meal Type
                    </label>
                    <select
                      value={selectedMealType}
                      onChange={(e) => setSelectedMealType(e.target.value as MealType)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      {MEAL_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={newPlan.startDate}
                  onChange={(e) =>
                    setNewPlan({ ...newPlan, startDate: e.target.value })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Days
                </label>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={newPlan.days}
                  onChange={(e) =>
                    setNewPlan({ ...newPlan, days: parseInt(e.target.value) })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2">
                {mealPlans.length > 0 && (
                  <button
                    onClick={() => setShowNewPlanForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={createMealPlan}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Create Plan
                </button>
              </div>
            </>
          )}

          {selectedPlan && !showNewPlanForm && (
            <button
              onClick={addRecipeToMealPlan}
              disabled={loading}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add to Meal Plan'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}