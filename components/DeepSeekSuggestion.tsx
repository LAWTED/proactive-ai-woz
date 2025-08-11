"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Check, X, Sparkles, Loader2, ArrowDown } from "lucide-react";
import { throttle } from "lodash";
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
  originalContext: string;
  fullText?: string; // 完整原文
  visible: boolean;
  isSending?: boolean;
}

export default function DeepSeekSuggestion({ content, onApply, wizardSessionId, userId }: DeepSeekSuggestionProps) {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSuggestionInternal = useCallback(async () => {
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
        // Add new suggestion to the beginning of the list (newest first)
        setSuggestions(prev => {
          const newSuggestion = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            text: data.suggestion.trim(),
            originalContext: data.originalContext || "",
            fullText: data.fullText || "", // 保存完整原文
            visible: true,
            isSending: false
          };

          // Add to beginning and keep only the latest MAX_VISIBLE_SUGGESTIONS visible
          const updatedList = [newSuggestion, ...prev];

          // Mark only the first MAX_VISIBLE_SUGGESTIONS as visible, rest as hidden
          return updatedList.map((s, index) => ({
            ...s,
            visible: index < MAX_VISIBLE_SUGGESTIONS
          }));
        });
      }
    } catch (error) {
      console.error("Failed to fetch suggestion:", error);
    } finally {
      setIsLoading(false);
    }
  }, [content]);

  // Create throttled version with trailing call support
  const throttledFetchSuggestion = useMemo(
    () => throttle(fetchSuggestionInternal, 10000, {
      leading: true,   // Execute immediately on first call
      trailing: true   // Execute final call after throttle period
    }),
    [fetchSuggestionInternal]
  );

  // Manual fetch function that bypasses throttling
  const fetchSuggestionManual = useCallback(async () => {
    await fetchSuggestionInternal();
  }, [fetchSuggestionInternal]);

  useEffect(() => {
    const debounceTimer = setTimeout(throttledFetchSuggestion, 500);
    return () => clearTimeout(debounceTimer);
  }, [throttledFetchSuggestion]);

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
        type: 'append',
        selected_text: suggestion.originalContext, // 保持原逻辑，只保存最后一句
        full_text: suggestion.fullText // 新字段：保存完整原文
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
    // Clear all suggestions completely
    setSuggestions([]);
  };

  const handleNewSuggestion = () => {
    setIsLoading(true);
    fetchSuggestionManual(); // Manual request, bypass throttle
  };

  // Filter to only show visible suggestions
  const visibleSuggestions = suggestions
    .filter(s => s.visible)
    .slice(0, MAX_VISIBLE_SUGGESTIONS);

  // Count total visible suggestions
  const totalVisible = suggestions.filter(s => s.visible).length;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {isLoading && (
        <div className="flex flex-col px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-900/50 text-sm text-blue-600 dark:text-blue-300">
          <div className="flex items-center mb-2">
            <Loader2 size={16} className="mr-2 animate-spin" />
            <span className="font-semibold">补全: 加载中...</span>
          </div>
        </div>
      )}

      {visibleSuggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className="flex flex-col px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-900/50 text-sm text-blue-600 dark:text-blue-300"
        >
          {/* 显示原文上下文 */}
          {suggestion.originalContext && (
            <div className="mb-2">
              <div className="text-xs text-gray-500 mb-1">原文:</div>
              <div className="bg-gray-100 p-2 rounded text-sm text-gray-700 font-mono border">
                &ldquo;{suggestion.originalContext}&rdquo;
              </div>
            </div>
          )}

          {/* 显示建议内容和操作按钮 */}
          <div className="flex items-center">
            <span className="font-semibold mr-2 shrink-0">补全:</span>
            <span className="mr-2 flex-grow">{suggestion.text}</span>
            <div className="flex items-center">
              <button
                onClick={() => handleSend(suggestion)}
                className={`ml-1 p-1 rounded-full ${
                  suggestion.isSending
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-blue-100 dark:hover:bg-blue-800'
                }`}
                title="发送补全"
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
                className="ml-1 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800"
                title="插入到编辑器"
                disabled={suggestion.isSending}
              >
                <ArrowDown size={16} />
              </button>
              <button
                onClick={() => handleDismiss(suggestion.id)}
                className="ml-1 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800"
                title="忽略"
                disabled={suggestion.isSending}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Show indicator if there are more suggestions not being displayed */}
      {totalVisible > MAX_VISIBLE_SUGGESTIONS && (
        <div className="flex items-center px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300">
          +{totalVisible - MAX_VISIBLE_SUGGESTIONS} 更多补全
        </div>
      )}

      <button
        onClick={handleNewSuggestion}
        className="flex items-center justify-center px-3 py-2 mt-1 rounded-md bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        disabled={isLoading}
      >
        <Sparkles size={16} className="mr-2" />
        <span>{visibleSuggestions.length > 0 ? "刷新补全" : "获取补全"}</span>
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