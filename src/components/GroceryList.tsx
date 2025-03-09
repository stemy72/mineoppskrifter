import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Save,
  Copy,
  List,
  Edit2,
  X,
  RefreshCw,
} from 'lucide-react';
import { formatDateRange } from '../lib/date';

interface GroceryItem {
  id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  checked: boolean;
  is_custom: boolean;
}

interface GroceryList {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  finalized: boolean;
  finalized_at: string | null;
  meal_plan_id: string;
}

export default function GroceryList() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItem, setNewItem] = useState({ name: '', amount: '', unit: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentList, setCurrentList] = useState<GroceryList | null>(null);
  const [savedLists, setSavedLists] = useState<GroceryList[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    if (id) {
      fetchGroceryList();
      fetchSavedLists();
    }
  }, [user, authLoading, id]);

  const fetchSavedLists = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('grocery_lists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedLists(data || []);
    } catch (error) {
      console.error('Error fetching saved lists:', error);
    }
  };

  const fetchGroceryList = async () => {
    if (!user || !id) return;

    try {
      // First verify the user has access to this list
      const { data: listData, error: listError } = await supabase
        .from('grocery_lists')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (listError) {
        if (listError.code === 'PGRST116') {
          navigate('/');
          return;
        }
        throw listError;
      }

      setCurrentList(listData);

      const { data: itemsData, error: itemsError } = await supabase
        .from('grocery_items')
        .select('*')
        .eq('grocery_list_id', id)
        .order('name');

      if (itemsError) throw itemsError;
      setItems(itemsData || []);
    } catch (error) {
      console.error('Error fetching grocery list:', error);
      setError('Failed to load grocery list');
    } finally {
      setLoading(false);
    }
  };

  const addItem = async () => {
    if (!newItem.name.trim() || !id || !user) return;

    try {
      const { data, error } = await supabase
        .from('grocery_items')
        .insert([
          {
            grocery_list_id: id,
            name: newItem.name.trim(),
            amount: newItem.amount ? parseFloat(newItem.amount) : null,
            unit: newItem.unit.trim() || null,
            is_custom: true,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setItems([...items, data]);
      setNewItem({ name: '', amount: '', unit: '' });
      setSuccess('Item added successfully');
    } catch (error) {
      console.error('Error adding item:', error);
      setError('Failed to add item');
    }
  };

  const toggleItem = async (itemId: string) => {
    if (!user) return;

    try {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      const { error } = await supabase
        .from('grocery_items')
        .update({ checked: !item.checked })
        .eq('id', itemId);

      if (error) throw error;

      setItems(
        items.map((i) =>
          i.id === itemId ? { ...i, checked: !i.checked } : i
        )
      );
    } catch (error) {
      console.error('Error toggling item:', error);
      setError('Failed to update item');
    }
  };

  const removeItem = async (itemId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('grocery_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setItems(items.filter((i) => i.id !== itemId));
      setSuccess('Item removed successfully');
    } catch (error) {
      console.error('Error removing item:', error);
      setError('Failed to remove item');
    }
  };

  const duplicateList = async () => {
    if (!currentList || !user) return;

    try {
      // Create new list
      const { data: newList, error: createError } = await supabase
        .from('grocery_lists')
        .insert([{
          user_id: user.id,
          name: `${currentList.name} (Copy)`,
          start_date: currentList.start_date,
          end_date: currentList.end_date,
          finalized: false,
          finalized_at: null
        }])
        .select()
        .single();

      if (createError) throw createError;

      // Copy items to new list
      const itemsToInsert = items.map(({ id, grocery_list_id, ...item }) => ({
        ...item,
        grocery_list_id: newList.id,
        checked: false
      }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('grocery_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      setSuccess('List duplicated successfully');
      fetchSavedLists();
    } catch (error) {
      console.error('Error duplicating list:', error);
      setError('Failed to duplicate list');
    }
  };

  const finalizeList = async () => {
    if (!currentList || !user) return;

    try {
      const { error } = await supabase
        .from('grocery_lists')
        .update({
          finalized: true,
          finalized_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setCurrentList({
        ...currentList,
        finalized: true,
        finalized_at: new Date().toISOString()
      });
      setSuccess('List finalized successfully');
    } catch (error) {
      console.error('Error finalizing list:', error);
      setError('Failed to finalize list');
    }
  };

  const deleteList = async (listId: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this list?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('grocery_lists')
        .delete()
        .eq('id', listId)
        .eq('user_id', user.id);

      if (error) throw error;

      if (listId === id) {
        // If we're deleting the current list, navigate to the first available list or home
        const remainingLists = savedLists.filter(l => l.id !== listId);
        if (remainingLists.length > 0) {
          navigate(`/grocery-list/${remainingLists[0].id}`);
        } else {
          navigate('/');
        }
      } else {
        // Otherwise just refresh the saved lists
        fetchSavedLists();
      }
      setSuccess('List deleted successfully');
    } catch (error) {
      console.error('Error deleting list:', error);
      setError('Failed to delete list');
    }
  };

  const updateListName = async () => {
    if (!currentList || !newName.trim() || !user) return;

    try {
      const { error } = await supabase
        .from('grocery_lists')
        .update({ name: newName.trim() })
        .eq('id', currentList.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setCurrentList({ ...currentList, name: newName.trim() });
      setEditingName(false);
      setSuccess('List name updated successfully');
      fetchSavedLists();
    } catch (error) {
      console.error('Error updating list name:', error);
      setError('Failed to update list name');
    }
  };

  const startEditingName = () => {
    if (currentList) {
      setNewName(currentList.name);
      setEditingName(true);
    }
  };

  const regenerateList = async () => {
    if (!currentList || !user) return;

    try {
      // First delete all existing items
      const { error: deleteError } = await supabase
        .from('grocery_items')
        .delete()
        .eq('grocery_list_id', currentList.id);

      if (deleteError) throw deleteError;

      // Get the meal plan associated with this list
      const { data: mealPlan, error: mealPlanError } = await supabase
        .from('meal_plans')
        .select(`
          id,
          meal_plan_recipes (
            recipe_id
          )
        `)
        .eq('id', currentList.meal_plan_id)
        .single();

      if (mealPlanError) throw mealPlanError;

      // Get all ingredients for the recipes
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('ingredients')
        .select('name, amount, unit')
        .in(
          'recipe_id',
          mealPlan.meal_plan_recipes.map((r) => r.recipe_id)
        );

      if (ingredientsError) throw ingredientsError;

      // Consolidate ingredients
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
            grocery_list_id: currentList.id,
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

      setSuccess('Grocery list regenerated successfully');
      fetchGroceryList();
    } catch (error) {
      console.error('Error regenerating grocery list:', error);
      setError('Failed to regenerate grocery list');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!currentList) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
        <h2 className="mt-4 text-lg font-medium text-gray-900">List not found</h2>
        <p className="mt-2 text-gray-500">
          The grocery list you're looking for doesn't exist or you don't have access to it.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main content */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-indigo-600" />
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="text-2xl font-bold text-gray-900 border-b-2 border-indigo-600 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={updateListName}
                    className="text-green-600 hover:text-green-700"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {currentList.name}
                  </h1>
                  <button
                    onClick={startEditingName}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-4">
              <button
                onClick={regenerateList}
                className="flex items-center px-4 py-2 text-indigo-600 border border-indigo-600 rounded-md hover:bg-indigo-50"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Regenerate List
              </button>
              <button
                onClick={duplicateList}
                className="flex items-center px-4 py-2 text-indigo-600 border border-indigo-600 rounded-md hover:bg-indigo-50"
              >
                <Copy className="h-5 w-5 mr-2" />
                Duplicate
              </button>
              {!currentList.finalized && (
                <button
                  onClick={finalizeList}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Save className="h-5 w-5 mr-2" />
                  Finalize
                </button>
              )}
            </div>
          </div>

          {(error || success) && (
            <div
              className={`mb-4 p-4 ${
                error
                  ? 'bg-red-100 border-red-400 text-red-700'
                  : 'bg-green-100 border-green-400 text-green-700'
              } rounded-md flex items-center`}
            >
              {error ? (
                <AlertCircle className="h-5 w-5 mr-2" />
              ) : (
                <Check className="h-5 w-5 mr-2" />
              )}
              {error || success}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Add Item</h2>
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  placeholder="Item name"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={newItem.amount}
                  onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
                  className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Unit"
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                  className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <button
                  onClick={addItem}
                  disabled={!newItem.name.trim()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add
                </button>
              </div>
            </div>

            <ul className="divide-y divide-gray-200">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`p-4 flex items-center justify-between hover:bg-gray-50 ${
                    item.checked ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center flex-1">
                    <button
                      onClick={() => toggleItem(item.id)}
                      className={`p-1 rounded-md mr-3 ${
                        item.checked
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <Check className="h-5 w-5" />
                    </button>
                    <span
                      className={`flex-1 ${
                        item.checked ? 'line-through text-gray-400' : ''
                      }`}
                    >
                      {item.name}
                      {item.amount && (
                        <span className="text-gray-500">
                          {' '}
                          - {item.amount} {item.unit}
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="ml-4 text-red-600 hover:text-red-700 p-1"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </li>
              ))}
              {items.length === 0 && (
                <li className="p-8 text-center text-gray-500">
                  No items in your grocery list
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Saved lists sidebar */}
        <div className="lg:w-80">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <List className="h-5 w-5 mr-2" />
              Saved Lists
            </h2>
            <div className="space-y-3">
              {savedLists.map((list) => (
                <div
                  key={list.id}
                  className={`relative group p-3 rounded-lg border ${
                    list.id === id
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-600 hover:bg-gray-50'
                  }`}
                >
                  <a href={`/grocery-list/${list.id}`}>
                    <h3 className="font-medium text-gray-900">{list.name}</h3>
                    <p className="text-sm text-gray-500">
                      {formatDateRange(list.start_date, list.end_date)}
                    </p>
                    {list.finalized && (
                      <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        <Check className="h-3 w-3 mr-1" />
                        Finalized
                      </span>
                    )}
                  </a>
                  <button
                    onClick={() => deleteList(list.id)}
                    className="absolute top-2 right-2 p-1 text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete list"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {savedLists.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  No saved lists yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}