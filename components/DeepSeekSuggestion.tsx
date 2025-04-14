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
        // Split the suggestion by || to get multiple suggestions
        const suggestionsArray: string[] = data.suggestion.split('||');

        // Add each suggestion to the list
        setSuggestions(prev => {
          const newSuggestions = suggestionsArray.map(suggestionText => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // Ensure unique IDs
            text: suggestionText.trim(),
            visible: true,
            isSending: false
          }));

          // Count current visible suggestions
          const visibleCount = prev.filter(s => s.visible).length;

          // If we have too many visible suggestions, hide the oldest ones
          if (visibleCount + newSuggestions.length > MAX_VISIBLE_SUGGESTIONS) {
            const visibleSuggestions = [...prev].filter(s => s.visible);
            const numToHide = Math.min(visibleCount, visibleCount + newSuggestions.length - MAX_VISIBLE_SUGGESTIONS);
            const idsToHide = visibleSuggestions.slice(0, numToHide).map(s => s.id);

            return [
              ...prev.map(s => idsToHide.includes(s.id) ? { ...s, visible: false } : s),
              ...newSuggestions
            ];
          }

          // Otherwise just add the new suggestions
          return [...prev, ...newSuggestions];
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
      {visibleSuggestions.map(suggestion => {
        // Determine what type of suggestion this is based on its index in the array
        let bgColorClass = "bg-blue-50 dark:bg-blue-900/50";
        let textColorClass = "text-blue-600 dark:text-blue-300";

        // Find the actual index by grouping by creation time
        const creationTime = suggestion.id.split('+')[0]; // Get timestamp part of ID
        const sameTimeGroup = visibleSuggestions.filter(s => s.id.startsWith(creationTime));
        const indexInGroup = sameTimeGroup.findIndex(s => s.id === suggestion.id);

        if (indexInGroup === 0 || indexInGroup % 3 === 0) {
          bgColorClass = "bg-blue-50 dark:bg-blue-900/50";
          textColorClass = "text-blue-600 dark:text-blue-300";
        } else if (indexInGroup === 1 || indexInGroup % 3 === 1) {
          bgColorClass = "bg-purple-50 dark:bg-purple-900/50";
          textColorClass = "text-purple-600 dark:text-purple-300";
        } else {
          bgColorClass = "bg-green-50 dark:bg-green-900/50";
          textColorClass = "text-green-600 dark:text-green-300";
        }

        return (
          <div
            key={suggestion.id}
            className={`inline-flex items-center px-3 py-1 rounded-full ${bgColorClass} text-sm ${textColorClass}`}
          >
            <span className="mr-2">{suggestion.text}</span>
            <button
              onClick={() => handleSend(suggestion)}
              className={`ml-1 p-0.5 rounded-full ${
                suggestion.isSending
                  ? 'opacity-50 cursor-not-allowed'
                  : `hover:${bgColorClass.replace('50', '100')} dark:hover:${bgColorClass.replace('900/50', '800')}`
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
              className={`ml-1 p-0.5 rounded-full hover:${bgColorClass.replace('50', '100')} dark:hover:${bgColorClass.replace('900/50', '800')}`}
              title="Insert into editor"
              disabled={suggestion.isSending}
            >
              <ArrowDown size={16} />
            </button>
            <button
              onClick={() => handleDismiss(suggestion.id)}
              className={`ml-1 p-0.5 rounded-full hover:${bgColorClass.replace('50', '100')} dark:hover:${bgColorClass.replace('900/50', '800')}`}
              title="Dismiss"
              disabled={suggestion.isSending}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}

      {/* Show indicator if there are more suggestions not being displayed */}
      {totalVisible > MAX_VISIBLE_SUGGESTIONS && (
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300">
          +{totalVisible - MAX_VISIBLE_SUGGESTIONS} more
        </div>
      )}

      {isLoading && (
        <>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/50 text-sm text-blue-600 dark:text-blue-300">
            <Loader2 size={16} className="mr-2 animate-spin" />
            <span className="font-semibold mr-1">补全:</span>
            <span>加载中...</span>
          </div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/50 text-sm text-purple-600 dark:text-purple-300">
            <Loader2 size={16} className="mr-2 animate-spin" />
            <span className="font-semibold mr-1">关键词:</span>
            <span>加载中...</span>
          </div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/50 text-sm text-green-600 dark:text-green-300">
            <Loader2 size={16} className="mr-2 animate-spin" />
            <span className="font-semibold mr-1">期待:</span>
            <span>加载中...</span>
          </div>
        </>
      )}

      <button
        onClick={handleNewSuggestion}
        className="inline-flex items-center px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/50 text-sm text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-800"
        disabled={isLoading}
      >
        <Sparkles size={16} className="mr-1" />
        新建议
      </button>

      {totalVisible > 0 && (
        <button
          onClick={handleDismissAll}
          className="inline-flex items-center px-3 py-1 rounded-full bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <X size={16} className="mr-1" />
          清除全部
        </button>
      )}
    </div>
  );
}