import React from 'react';
import IngredientsManager from '../../IngredientsManager';

interface Ingredient {
  id: string;
  name: string;
  amount: string;
  unit: string;
  isSection?: boolean;
}

interface RecipeIngredientsSectionProps {
  ingredients: Ingredient[];
  onChange: (ingredients: Ingredient[]) => void;
}

export function RecipeIngredientsSection({ ingredients, onChange }: RecipeIngredientsSectionProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Ingredients
      </label>
      <IngredientsManager
        ingredients={ingredients}
        onChange={onChange}
      />
    </div>
  );
}