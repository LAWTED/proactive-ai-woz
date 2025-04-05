"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, X, Sparkles, Loader2, ArrowDown } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Maximum number of suggestions to show at once
const MAX_VISIBLE_SUGGESTIONS = 3;

interface DeepSeekSuggestionProps {
  content: string;
  onApply: (suggestion: string) => void;
  wizardSessionId?: string;
  userId?: number;
}

interface SuggestionItem {
  id: string;
  text: string;
  visible: boolean;
  isSending?: boolean;
}

export default function DeepSeekSuggestion({ content, onApply, wizardSessionId, userId }: DeepSeekSuggestionProps) {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSuggestion = useCallback(async () => {
    if (!content.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/suggestion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: content,
        }),
      });

      const data = await response.json();
      if (data.suggestion) {
        // Add new suggestion to the list
        setSuggestions(prev => {
          const newSuggestion = {
            id: Date.now().toString(),
            text: data.suggestion,
            visible: true,
            isSending: false
          };

          // Count current visible suggestions
          const visibleCount = prev.filter(s => s.visible).length;

          // If we're at max capacity, hide the oldest visible suggestion
          if (visibleCount >= MAX_VISIBLE_SUGGESTIONS) {
            const visibleSuggestions = [...prev].filter(s => s.visible);
            const oldestId = visibleSuggestions[0].id;

            return [
              ...prev.map(s => s.id === oldestId ? { ...s, visible: false } : s),
              newSuggestion
            ];
          }

          // Otherwise just add the new suggestion
          return [...prev, newSuggestion];
        });
      }
    } catch (error) {
      console.error("Failed to fetch suggestion:", error);
    } finally {
      setIsLoading(false);
    }
  }, [content]);

  useEffect(() => {
    const debounceTimer = setTimeout(fetchSuggestion, 500);
    return () => clearTimeout(debounceTimer);
  }, [fetchSuggestion]);

  // Apply suggestion to editor (insert)
  const handleApply = (suggestion: SuggestionItem) => {
    onApply(suggestion.text);
    // Hide this suggestion after applying
    setSuggestions(prev =>
      prev.map(s => s.id === suggestion.id ? { ...s, visible: false } : s)
    );
  };

  // Send suggestion to user
  const handleSend = async (suggestion: SuggestionItem) => {
    if (!wizardSessionId || !userId || suggestion.isSending) return;

    // Mark this suggestion as sending
    setSuggestions(prev =>
      prev.map(s => s.id === suggestion.id ? { ...s, isSending: true } : s)
    );

    try {
      await supabase.from('suggestions').insert({
        content: suggestion.text,
        user_id: userId,
        wizard_session_id: wizardSessionId,
        type: 'append'
      });

      // Hide suggestion after sending successfully
      setSuggestions(prev =>
        prev.map(s => s.id === suggestion.id ? { ...s, visible: false } : s)
      );
    } catch (error) {
      console.error('Failed to send suggestion:', error);

      // Reset sending state if failed
      setSuggestions(prev =>
        prev.map(s => s.id === suggestion.id ? { ...s, isSending: false } : s)
      );
    }
  };

  const handleDismiss = (id: string) => {
    // Hide this suggestion
    setSuggestions(prev =>
      prev.map(s => s.id === id ? { ...s, visible: false } : s)
    );
  };

  const handleDismissAll = () => {
    // Hide all suggestions
    setSuggestions(prev =>
      prev.map(s => ({ ...s, visible: false }))
    );
  };

  const handleNewSuggestion = () => {
    setIsLoading(true);
    fetchSuggestion();
  };

  // Filter to only show visible suggestions
  const visibleSuggestions = suggestions
    .filter(s => s.visible)
    .slice(0, MAX_VISIBLE_SUGGESTIONS);

  // Count total visible suggestions
  const totalVisible = suggestions.filter(s => s.visible).length;

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {visibleSuggestions.map(suggestion => (
        <div
          key={suggestion.id}
          className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/50 text-sm text-blue-600 dark:text-blue-300"
        >
          <span className="mr-2">{suggestion.text}</span>
          <button
            onClick={() => handleSend(suggestion)}
            className={`ml-1 p-0.5 rounded-full ${
              suggestion.isSending
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-blue-100 dark:hover:bg-blue-800'
            }`}
            title="Send as suggestion"
            disabled={suggestion.isSending}
          >
            {suggestion.isSending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
          </button>
          <button
            onClick={() => handleApply(suggestion)}
            className="ml-1 p-0.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800"
            title="Insert into editor"
            disabled={suggestion.isSending}
          >
            <ArrowDown size={16} />
          </button>
          <button
            onClick={() => handleDismiss(suggestion.id)}
            className="ml-1 p-0.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800"
            title="Dismiss"
            disabled={suggestion.isSending}
          >
            <X size={16} />
          </button>
        </div>
      ))}

      {/* Show indicator if there are more suggestions not being displayed */}
      {totalVisible > MAX_VISIBLE_SUGGESTIONS && (
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300">
          +{totalVisible - MAX_VISIBLE_SUGGESTIONS} more
        </div>
      )}

      {isLoading && (
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300">
          <Loader2 size={16} className="mr-2 animate-spin" />
          <span>Loading suggestion...</span>
        </div>
      )}

      <button
        onClick={handleNewSuggestion}
        className="inline-flex items-center px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/50 text-sm text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-800"
        disabled={isLoading}
      >
        <Sparkles size={16} className="mr-1" />
        New Suggestion
      </button>

      {totalVisible > 0 && (
        <button
          onClick={handleDismissAll}
          className="inline-flex items-center px-3 py-1 rounded-full bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <X size={16} className="mr-1" />
          Clear All
        </button>
      )}
    </div>
  );
}