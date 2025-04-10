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
        {visibleSuggestions.map(suggestion => (
          <div
            key={suggestion.id}
            className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-50 dark:bg-yellow-900/50 text-sm text-yellow-600 dark:text-yellow-300"
          >
            <span className="font-medium text-gray-700 italic mr-2">&ldquo;{suggestion.text}&rdquo;</span>
            <button
              onClick={() => handleSend(suggestion)}
              className={`ml-1 p-0.5 rounded-full ${
                suggestion.isSending
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-yellow-100 dark:hover:bg-yellow-800'
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
              className="ml-1 p-0.5 rounded-full hover:bg-yellow-100 dark:hover:bg-yellow-800"
              title="Insert into editor"
              disabled={suggestion.isSending}
            >
              <ArrowDown size={16} />
            </button>
            <button
              onClick={() => handleDismiss(suggestion.id)}
              className="ml-1 p-0.5 rounded-full hover:bg-yellow-100 dark:hover:bg-yellow-800"
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
            <span>Loading reaction...</span>
          </div>
        )}

        <button
          onClick={handleNewSuggestion}
          className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-50 dark:bg-yellow-900/50 text-sm text-yellow-600 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-800"
          disabled={isLoading}
        >
          <Sparkles size={16} className="mr-1" />
          New Reaction
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
    </div>
  );
}