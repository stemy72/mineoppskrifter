import React, { useState, useEffect } from 'react';
import { Tag, Info } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';

interface Tag {
  id: string;
  name: string;
}

interface RecipeTagsSectionProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export function RecipeTagsSection({ selectedTags, onChange }: RecipeTagsSectionProps) {
  const { user } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from('global_tags')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Tags
      </label>

      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={`tag-${tag.id}`}
            type="button"
            onClick={() => {
              onChange(
                selectedTags.includes(tag.id)
                  ? selectedTags.filter((id) => id !== tag.id)
                  : [...selectedTags, tag.id]
              );
            }}
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm transition-colors ${
              selectedTags?.includes(tag.id)
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            } hover:bg-green-50`}
          >
            <Tag className="h-4 w-4 mr-1" />
            {tag.name}
          </button>
        ))}
        {tags.length === 0 && (
          <p className="flex items-center text-sm text-gray-500">
            <Info className="h-4 w-4 mr-1 flex-shrink-0" />
            No tags available. Please contact an administrator to add global tags.
          </p>
        )}
        <p className="w-full mt-2 text-sm text-gray-500">
          Select from available tags to categorize your recipe
        </p>
      </div>
    </div>
  );
}