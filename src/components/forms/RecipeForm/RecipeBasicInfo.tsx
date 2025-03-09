import React from 'react';
import { Link2, Users, Clock } from 'lucide-react';

interface RecipeBasicInfoProps {
  title: string;
  sourceUrl: string;
  servings: string;
  cookingTime: string;
  description: string;
  onChange: (field: string, value: string) => void;
}

export function RecipeBasicInfo({
  title,
  sourceUrl,
  servings,
  cookingTime,
  description,
  onChange
}: RecipeBasicInfoProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onChange('title', e.target.value)}
          required
          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Source URL
        </label>
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => onChange('sourceUrl', e.target.value)}
            placeholder="https://example.com/recipe"
            className="w-full pl-10 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">Optional: Link to the original recipe source</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center">
              <Users className="h-4 w-4 mr-1" />
              Servings
            </div>
          </label>
          <input
            type="number"
            min="1"
            value={servings}
            onChange={(e) => onChange('servings', e.target.value)}
            placeholder="Number of servings"
            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              Cooking Time (minutes)
            </div>
          </label>
          <input
            type="number"
            min="1"
            value={cookingTime}
            onChange={(e) => onChange('cookingTime', e.target.value)}
            placeholder="Total cooking time"
            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => onChange('description', e.target.value)}
          rows={3}
          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>
    </>
  );
}