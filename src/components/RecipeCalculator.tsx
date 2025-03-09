import React, { useState, useEffect } from 'react';
import { Calculator } from 'lucide-react';

interface Ingredient {
  id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  isSection?: boolean;
}

interface RecipeCalculatorProps {
  originalServings: number | null;
  ingredients: Ingredient[];
}

function roundToReadableNumber(num: number): number {
  // Handle common fractions
  const fractions = [
    { decimal: 0.25, fraction: 0.25 }, // 1/4
    { decimal: 0.33, fraction: 0.33 }, // 1/3
    { decimal: 0.5, fraction: 0.5 },   // 1/2
    { decimal: 0.67, fraction: 0.67 }, // 2/3
    { decimal: 0.75, fraction: 0.75 }  // 3/4
  ];

  // Check if the number is close to any common fraction
  for (const { decimal, fraction } of fractions) {
    if (Math.abs(num % 1 - decimal) < 0.05) {
      return Math.floor(num) + fraction;
    }
  }

  // For other numbers, round to 2 decimal places
  return Number(num.toFixed(2));
}

export default function RecipeCalculator({ originalServings, ingredients }: RecipeCalculatorProps) {
  const [desiredServings, setDesiredServings] = useState<number>(originalServings || 1);
  const [inputValue, setInputValue] = useState<string>((originalServings || 1).toString());
  const [scaledIngredients, setScaledIngredients] = useState<Ingredient[]>(ingredients);
  const [showCalculator, setShowCalculator] = useState(false);

  useEffect(() => {
    if (!originalServings) return;

    // Only calculate when we have a valid number of desired servings
    if (desiredServings > 0) {
      const scaleFactor = desiredServings / originalServings;
      const scaled = ingredients.map(ing => {
        if (ing.isSection || !ing.amount) return ing;
        return {
          ...ing,
          amount: roundToReadableNumber(ing.amount * scaleFactor)
        };
      });
      setScaledIngredients(scaled);
    }
  }, [desiredServings, originalServings, ingredients]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow empty input for better UX while typing
    const value = e.target.value;
    setInputValue(value);
    
    // Only update actual servings if we have a valid number
    if (value !== '') {
      const parsed = parseInt(value);
      if (!isNaN(parsed)) {
        // Allow any valid number, but use 1 as minimum for calculations
        setDesiredServings(parsed > 0 ? parsed : 1);
      }
    }
  };

  const handleInputBlur = () => {
    // When the field loses focus, ensure we always have a valid value
    if (inputValue === '' || parseInt(inputValue) <= 0) {
      setInputValue('1');
      setDesiredServings(1);
    }
  };

  if (!originalServings) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setShowCalculator(!showCalculator)}
        className="flex items-center text-sm text-indigo-600 hover:text-indigo-500 mb-2"
      >
        <Calculator className="h-4 w-4 mr-1" />
        {showCalculator ? 'Hide Calculator' : 'Adjust Servings'}
      </button>

      {showCalculator && (
        <div className="bg-indigo-50 p-4 rounded-lg">
          <div className="flex items-center gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desired Servings
              </label>
              <input
                type="number"
                min="1"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div className="text-sm text-gray-500">
              Original recipe serves {originalServings}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Original</h3>
              <ul className="space-y-2">
                {ingredients.map((ing) => (
                  <li 
                    key={ing.id}
                    className={ing.isSection ? 'font-bold text-gray-900 mt-4 first:mt-0' : 'text-gray-600'}
                  >
                    {ing.isSection ? (
                      ing.name
                    ) : (
                      <span>
                        {ing.amount && ing.unit 
                          ? `${ing.amount} ${ing.unit} ${ing.name}`
                          : ing.name
                        }
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Scaled ({desiredServings} servings)</h3>
              <ul className="space-y-2">
                {scaledIngredients.map((ing) => (
                  <li 
                    key={ing.id}
                    className={ing.isSection ? 'font-bold text-gray-900 mt-4 first:mt-0' : 'text-gray-600'}
                  >
                    {ing.isSection ? (
                      ing.name
                    ) : (
                      <span>
                        {ing.amount && ing.unit 
                          ? `${ing.amount} ${ing.unit} ${ing.name}`
                          : ing.name
                        }
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}