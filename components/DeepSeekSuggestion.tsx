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
  label?: string;
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

        // Add each suggestion to the list with specific labels
        const labels = ["补全", "关键字", "期待"];
        const newSuggestions = suggestionsArray.map((suggestionText, index) => ({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // Ensure unique IDs
          text: suggestionText.trim(),
          visible: true,
          isSending: false,
          label: labels[index % labels.length] // Assign a label based on index
        }));

        setSuggestions(newSuggestions);
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

  return (
    <div className="mb-4 flex flex-col gap-2">
      {isLoading ? (
        <>
          <div className="flex items-center px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-900/50 text-sm text-blue-600 dark:text-blue-300">
            <Loader2 size={16} className="mr-2 animate-spin" />
            <span className="font-semibold mr-2">补全:</span>
            <span>加载中...</span>
          </div>
          <div className="flex items-center px-3 py-2 rounded-md bg-purple-50 dark:bg-purple-900/50 text-sm text-purple-600 dark:text-purple-300">
            <Loader2 size={16} className="mr-2 animate-spin" />
            <span className="font-semibold mr-2">关键字:</span>
            <span>加载中...</span>
          </div>
          <div className="flex items-center px-3 py-2 rounded-md bg-green-50 dark:bg-green-900/50 text-sm text-green-600 dark:text-green-300">
            <Loader2 size={16} className="mr-2 animate-spin" />
            <span className="font-semibold mr-2">期待:</span>
            <span>加载中...</span>
          </div>
        </>
      ) : (
        visibleSuggestions.map((suggestion, index) => {
          // Determine styling based on index
          let bgColorClass = "bg-blue-50 dark:bg-blue-900/50";
          let textColorClass = "text-blue-600 dark:text-blue-300";
          let label = "补全";

          if (index === 0) {
            bgColorClass = "bg-blue-50 dark:bg-blue-900/50";
            textColorClass = "text-blue-600 dark:text-blue-300";
            label = "补全";
          } else if (index === 1) {
            bgColorClass = "bg-purple-50 dark:bg-purple-900/50";
            textColorClass = "text-purple-600 dark:text-purple-300";
            label = "关键字";
          } else {
            bgColorClass = "bg-green-50 dark:bg-green-900/50";
            textColorClass = "text-green-600 dark:text-green-300";
            label = "期待";
          }

          return (
            <div
              key={suggestion.id}
              className={`flex w-fit items-center px-3 py-2 rounded-md ${bgColorClass} text-sm ${textColorClass}`}
            >
              <span className="font-semibold mr-2">{label}:</span>
              <span className="mr-2 flex-grow">{suggestion.text}</span>
              <div className="flex items-center">
                <button
                  onClick={() => handleSend(suggestion)}
                  className={`ml-1 p-1 rounded-full ${
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
                  className={`ml-1 p-1 rounded-full hover:${bgColorClass.replace('50', '100')} dark:hover:${bgColorClass.replace('900/50', '800')}`}
                  title="Insert into editor"
                  disabled={suggestion.isSending}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  onClick={() => handleDismiss(suggestion.id)}
                  className={`ml-1 p-1 rounded-full hover:${bgColorClass.replace('50', '100')} dark:hover:${bgColorClass.replace('900/50', '800')}`}
                  title="Dismiss"
                  disabled={suggestion.isSending}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          );
        })
      )}

      <button
        onClick={handleNewSuggestion}
        className="flex items-center justify-center px-3 py-2 mt-1 rounded-md bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        disabled={isLoading}
      >
        <Sparkles size={16} className="mr-2" />
        <span>{visibleSuggestions.length > 0 ? "刷新建议" : "获取建议"}</span>
      </button>

      {visibleSuggestions.length > 0 && (
        <button
          onClick={handleDismissAll}
          className="flex items-center justify-center px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          disabled={isLoading}
        >
          <X size={16} className="mr-2" />
          <span>清除所有</span>
        </button>
      )}
    </div>
  );
}