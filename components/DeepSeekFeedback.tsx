"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, X, Sparkles, Loader2, ArrowDown } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Maximum number of suggestions to show at once
const MAX_VISIBLE_SUGGESTIONS = 3;

interface DeepSeekFeedbackProps {
  content: string;
  selectedText: string;
  selectedTextPosition?: number | null;
  selectedTextEndPosition?: number | null;
  onApply: (suggestion: string) => void;
  wizardSessionId?: string;
  userId?: number;
}

interface FeedbackItem {
  id: string;
  text: string;
  visible: boolean;
  isSending?: boolean;
}

export default function DeepSeekFeedback({
  content,
  selectedText,
  selectedTextPosition,
  selectedTextEndPosition,
  onApply,
  wizardSessionId,
  userId
}: DeepSeekFeedbackProps) {
  const [suggestions, setSuggestions] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSuggestion = useCallback(async () => {
    if (!selectedText.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/comment-suggestion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: content,
          selectedText: selectedText
        }),
      });

      const data = await response.json();
      if (data.suggestion) {
        // Split the suggestion by || to get multiple reactions
        const suggestionsArray: string[] = data.suggestion.split('||');

        // Add each reaction to the list
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
      console.error("Failed to fetch comment suggestion:", error);
    } finally {
      setIsLoading(false);
    }
  }, [content, selectedText]);

  useEffect(() => {
    // Only trigger if we have selected text
    if (selectedText.trim()) {
      const debounceTimer = setTimeout(fetchSuggestion, 500);
      return () => clearTimeout(debounceTimer);
    }
  }, [fetchSuggestion, selectedText]);

  // Apply suggestion to editor
  const handleApply = (suggestion: FeedbackItem) => {
    onApply(suggestion.text);
    // Hide this suggestion after applying
    setSuggestions(prev =>
      prev.map(s => s.id === suggestion.id ? { ...s, visible: false } : s)
    );
  };

  // Send comment suggestion to user
  const handleSend = async (suggestion: FeedbackItem) => {
    if (!wizardSessionId || !userId || suggestion.isSending) return;
    if (selectedTextPosition === null || selectedTextPosition === undefined) return;

    // Mark this suggestion as sending
    setSuggestions(prev =>
      prev.map(s => s.id === suggestion.id ? { ...s, isSending: true } : s)
    );

    try {
      await supabase.from('suggestions').insert({
        content: suggestion.text,
        user_id: userId,
        wizard_session_id: wizardSessionId,
        type: 'comment',
        position: selectedTextPosition,
        end_position: selectedTextEndPosition,
        selected_text: selectedText
      });

      // Hide suggestion after sending successfully
      setSuggestions(prev =>
        prev.map(s => s.id === suggestion.id ? { ...s, visible: false } : s)
      );
    } catch (error) {
      console.error('Failed to send comment suggestion:', error);

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

  // If no selected text, don't show anything
  if (!selectedText.trim()) {
    return null;
  }

  return (
    <div className="mb-2 mt-2">
      <div className="p-2 mb-2 bg-yellow-50 rounded-md border border-yellow-200">
        <p className="text-sm text-gray-500 mb-1">已选择文本:</p>
        <p className="text-gray-700 bg-white p-2 rounded border text-sm">{selectedText}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleSuggestions.map(suggestion => {
          // Determine what type of feedback this is based on its index in the array
          let bgColorClass = "bg-yellow-50 dark:bg-yellow-900/50";
          let textColorClass = "text-yellow-600 dark:text-yellow-300";

          // Find the actual index by grouping by creation time
          const creationTime = suggestion.id.split('+')[0]; // Get timestamp part of ID
          const sameTimeGroup = visibleSuggestions.filter(s => s.id.startsWith(creationTime));
          const indexInGroup = sameTimeGroup.findIndex(s => s.id === suggestion.id);

          if (indexInGroup === 0 || indexInGroup % 3 === 0) {
            bgColorClass = "bg-yellow-50 dark:bg-yellow-900/50";
            textColorClass = "text-yellow-600 dark:text-yellow-300";
          } else if (indexInGroup === 1 || indexInGroup % 3 === 1) {
            bgColorClass = "bg-orange-50 dark:bg-orange-900/50";
            textColorClass = "text-orange-600 dark:text-orange-300";
          } else {
            bgColorClass = "bg-red-50 dark:bg-red-900/50";
            textColorClass = "text-red-600 dark:text-red-300";
          }

          return (
            <div
              key={suggestion.id}
              className={`inline-flex items-center px-3 py-1 rounded-full ${bgColorClass} text-sm ${textColorClass}`}
            >
              <span className="font-medium text-gray-700 italic mr-2">{suggestion.text}</span>
              <button
                onClick={() => handleSend(suggestion)}
                className={`ml-1 p-0.5 rounded-full ${
                  suggestion.isSending
                    ? 'opacity-50 cursor-not-allowed'
                    : `hover:${bgColorClass.replace('50', '100')} dark:hover:${bgColorClass.replace('900/50', '800')}`
                }`}
                title="Send as reader reaction"
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
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-50 dark:bg-yellow-900/50 text-sm text-yellow-600 dark:text-yellow-300">
              <Loader2 size={16} className="mr-2 animate-spin" />
              <span className="font-semibold mr-1">润色:</span>
              <span>加载中...</span>
            </div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-900/50 text-sm text-orange-600 dark:text-orange-300">
              <Loader2 size={16} className="mr-2 animate-spin" />
              <span className="font-semibold mr-1">关键词:</span>
              <span>加载中...</span>
            </div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/50 text-sm text-red-600 dark:text-red-300">
              <Loader2 size={16} className="mr-2 animate-spin" />
              <span className="font-semibold mr-1">读者反馈:</span>
              <span>加载中...</span>
            </div>
          </>
        )}

        <button
          onClick={handleNewSuggestion}
          className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-50 dark:bg-yellow-900/50 text-sm text-yellow-600 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-800"
          disabled={isLoading}
        >
          <Sparkles size={16} className="mr-1" />
          新反馈
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
    </div>
  );
}