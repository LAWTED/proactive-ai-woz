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
  label?: string;
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

        // Add each reaction to the list with specific labels
        const labels = ["润色", "关键词", "读者反馈"];
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

      <div className="flex flex-col gap-2">
        {isLoading ? (
          <>
            <div className="flex items-center px-3 py-2 rounded-md bg-yellow-50 dark:bg-yellow-900/50 text-sm text-yellow-600 dark:text-yellow-300">
              <Loader2 size={16} className="mr-2 animate-spin" />
              <span className="font-semibold mr-2">润色:</span>
              <span>加载中...</span>
            </div>
            <div className="flex items-center px-3 py-2 rounded-md bg-orange-50 dark:bg-orange-900/50 text-sm text-orange-600 dark:text-orange-300">
              <Loader2 size={16} className="mr-2 animate-spin" />
              <span className="font-semibold mr-2">关键词:</span>
              <span>加载中...</span>
            </div>
            <div className="flex items-center px-3 py-2 rounded-md bg-red-50 dark:bg-red-900/50 text-sm text-red-600 dark:text-red-300">
              <Loader2 size={16} className="mr-2 animate-spin" />
              <span className="font-semibold mr-2">读者反馈:</span>
              <span>加载中...</span>
            </div>
          </>
        ) : (
          visibleSuggestions.map((suggestion, index) => {
            // Determine styling based on index
            let bgColorClass = "bg-yellow-50 dark:bg-yellow-900/50";
            let textColorClass = "text-yellow-600 dark:text-yellow-300";
            let label = "润色";

            if (index === 0) {
              bgColorClass = "bg-yellow-50 dark:bg-yellow-900/50";
              textColorClass = "text-yellow-600 dark:text-yellow-300";
              label = "润色";
            } else if (index === 1) {
              bgColorClass = "bg-orange-50 dark:bg-orange-900/50";
              textColorClass = "text-orange-600 dark:text-orange-300";
              label = "关键词";
            } else {
              bgColorClass = "bg-red-50 dark:bg-red-900/50";
              textColorClass = "text-red-600 dark:text-red-300";
              label = "读者反馈";
            }

            return (
              <div
                key={suggestion.id}
                className={`flex w-fit items-center px-3 py-2 rounded-md ${bgColorClass} text-sm ${textColorClass}`}
              >
                <span className="font-semibold mr-2">{label}:</span>
                <span className="mr-2 flex-grow font-medium text-gray-700">{suggestion.text}</span>
                <div className="flex items-center">
                  <button
                    onClick={() => handleSend(suggestion)}
                    className={`ml-1 p-1 rounded-full ${
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
          <span>{visibleSuggestions.length > 0 ? "刷新反馈" : "获取反馈"}</span>
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
    </div>
  );
}