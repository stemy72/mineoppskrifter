import React from 'react';

interface RecipeInstructionsSectionProps {
  instructions: string;
  onChange: (instructions: string) => void;
}

export function RecipeInstructionsSection({ instructions, onChange }: RecipeInstructionsSectionProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Instructions
      </label>
      <textarea
        value={instructions}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        required
        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
    </div>
  );
}