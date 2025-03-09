import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Share2, Globe, Mail, Check, AlertCircle, Users, Trash2 } from 'lucide-react';

interface ShareRecipeModalProps {
  recipeId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface SharedUser {
  email: string;
  shared_at: string;
}

export default function ShareRecipeModal({ recipeId, isOpen, onClose }: ShareRecipeModalProps) {
  const [email, setEmail] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchSharedInfo();
    }
  }, [isOpen]);

  const fetchSharedInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('shared_recipes')
        .select('shared_email, is_public, created_at')
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setIsPublic(data.some(share => share.is_public));
        setSharedUsers(
          data
            .filter(share => share.shared_email)
            .map(share => ({
              email: share.shared_email,
              shared_at: share.created_at
            }))
        );
      }
    } catch (error) {
      console.error('Error fetching shared info:', error);
    }
  };

  const handleRemoveShare = async (email: string) => {
    try {
      const { error } = await supabase
        .from('shared_recipes')
        .delete()
        .eq('recipe_id', recipeId)
        .eq('shared_email', email);

      if (error) throw error;

      setSharedUsers(prev => prev.filter(user => user.email !== email));
      setSuccess(`Removed share for ${email}`);
    } catch (error) {
      console.error('Error removing share:', error);
      setError('Failed to remove share. Please try again.');
    }
  };

  if (!isOpen) return null;

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isPublic) {
        // Share publicly
        const { error: shareError } = await supabase
          .from('shared_recipes')
          .insert([{
            recipe_id: recipeId,
            is_public: true
          }]);

        if (shareError) throw shareError;
        setSuccess('Recipe shared publicly!');
      } else if (email) {
        // First check if the recipe is already shared with this email
        const { data: existingShares, error: checkError } = await supabase
          .from('shared_recipes')
          .select('*')
          .eq('recipe_id', recipeId)
          .eq('shared_email', email.toLowerCase());

        if (checkError) throw checkError;

        // If there are any existing shares with this email, don't create a new one
        if (existingShares && existingShares.length > 0) {
          setError('Recipe is already shared with this email');
          setLoading(false);
          return;
        }

        // Share with specific email
        const { error: shareError } = await supabase
          .from('shared_recipes')
          .insert([{
            recipe_id: recipeId,
            shared_email: email.toLowerCase(),
            is_public: false
          }]);

        if (shareError) throw shareError;
        setSuccess('Recipe shared successfully! The recipient can access it by signing in with their email.');
      }

      setEmail('');
      fetchSharedInfo(); // Refresh the list after sharing
    } catch (error) {
      console.error('Error sharing recipe:', error);
      setError(error.message || 'Failed to share recipe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center">
            <Share2 className="h-5 w-5 mr-2" />
            Share Recipe
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current sharing status */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Current Status:</span>
            {isPublic ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                <Globe className="h-4 w-4 mr-1" />
                Public Recipe
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
                <Users className="h-4 w-4 mr-1" />
                Shared with {sharedUsers.length} user{sharedUsers.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {sharedUsers.length > 0 && (
            <div className="border rounded-lg p-3 space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Shared with:</h3>
              {sharedUsers.map((user) => (
                <div key={user.email} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{user.email}</span>
                  <button
                    onClick={() => handleRemoveShare(user.email)}
                    className="text-red-600 hover:text-red-700 p-1"
                    title="Remove share"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded flex items-center">
            <Check className="h-5 w-5 mr-2" />
            {success}
          </div>
        )}

        <form onSubmit={handleShare} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share with Email
            </label>
            <div className="flex items-center">
              <Mail className="h-5 w-5 text-gray-400 absolute ml-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                className="pl-10 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isPublic}
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="public-share"
              checked={isPublic}
              onChange={(e) => {
                setIsPublic(e.target.checked);
                if (e.target.checked) {
                  setEmail('');
                }
              }}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label
              htmlFor="public-share"
              className="ml-2 block text-sm text-gray-700 flex items-center"
            >
              <Globe className="h-4 w-4 mr-1" />
              Share publicly
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || (!email && !isPublic)}
            className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Sharing...' : 'Share Recipe'}
          </button>
        </form>
      </div>
    </div>
  );
}