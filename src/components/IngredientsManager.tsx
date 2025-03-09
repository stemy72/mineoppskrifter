import React, { useCallback } from 'react';
import { Plus, Minus, ArrowDownCircle } from 'lucide-react';

interface Ingredient {
  id: string;
  name: string;
  amount: string;
  unit: string;
  isSection?: boolean;
}

interface IngredientsManagerProps {
  ingredients: Ingredient[];
  onChange: (ingredients: Ingredient[]) => void;
}

function IngredientsManager({ ingredients, onChange }: IngredientsManagerProps) {
  const addIngredient = useCallback(() => {
    onChange([
      ...ingredients,
      {
        id: `ingredient-${Date.now()}`,
        name: '',
        amount: '',
        unit: '',
        isSection: false
      }
    ]);
  }, [ingredients, onChange]);

  const insertIngredientBelow = useCallback((index: number) => {
    const newIngredients = [...ingredients];
    newIngredients.splice(index + 1, 0, {
      id: `ingredient-${Date.now()}`,
      name: '',
      amount: '',
      unit: '',
      isSection: false
    });
    onChange(newIngredients);
  }, [ingredients, onChange]);

  const removeIngredient = useCallback((index: number) => {
    onChange(ingredients.filter((_, i) => i !== index));
  }, [ingredients, onChange]);

  const updateIngredient = useCallback((index: number, field: keyof Ingredient, value: string) => {
    const newIngredients = [...ingredients];
    if (field === 'name' && value.startsWith('#')) {
      newIngredients[index] = { 
        ...newIngredients[index], 
        [field]: value,
        isSection: true 
      };
    } else if (field === 'name' && !value.startsWith('#') && newIngredients[index].isSection) {
      newIngredients[index] = { 
        ...newIngredients[index], 
        [field]: value,
        isSection: false 
      };
    } else {
      newIngredients[index] = { ...newIngredients[index], [field]: value };
    }
    onChange(newIngredients);
  }, [ingredients, onChange]);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={addIngredient}
          className="inline-flex items-center px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-500 border border-indigo-600 rounded-md hover:bg-indigo-50"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Ingredient
        </button>
      </div>

      <div className="space-y-3">
        {ingredients.map((ingredient, index) => (
          <div
            key={ingredient.id}
            className={`flex gap-2 items-center bg-white rounded-lg p-2 border border-gray-200 shadow-sm ${
              ingredient.isSection ? 'mt-6 first:mt-0' : ''
            }`}
          >
            <input
              type="text"
              value={ingredient.name}
              onChange={(e) => updateIngredient(index, 'name', e.target.value)}
              placeholder={ingredient.isSection ? "Section name" : "Ingredient name"}
              className={`flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ${
                ingredient.isSection ? 'font-bold' : ''
              }`}
            />
            {!ingredient.isSection && (
              <>
                <input
                  type="number"
                  value={ingredient.amount}
                  onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                  placeholder="Amount"
                  className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={ingredient.unit}
                  onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                  placeholder="Unit"
                  className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </>
            )}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => insertIngredientBelow(index)}
                className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-full transition-colors"
                title="Insert row below"
              >
                <ArrowDownCircle className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => removeIngredient(index)}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                title="Remove ingredient"
              >
                <Minus className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default React.memo(IngredientsManager);