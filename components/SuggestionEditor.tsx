"use client";

import React from "react";

interface SuggestionEditorProps {
  value: string;
  onChange: (suggestion: string) => void;
  onSend: () => void;
  isSending?: boolean;
}

export default function SuggestionEditor({
  value,
  onChange,
  onSend,
  isSending = false,
}: SuggestionEditorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send suggestion on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !isSending) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border rounded p-2 bg-white">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium mb-1">创建建议</h2>

        <p className="text-xs text-gray-500 mt-0.5">
          按下 Ctrl+Enter 或 Cmd+Enter 发送
        </p>
      </div>
      <div className="mb-2">
        <textarea
          className="w-full h-16 p-2 text-sm border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="写一个能帮助用户的建议..."
          disabled={isSending}
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={onSend}
          disabled={!value.trim() || isSending}
          className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {isSending ? (
            <>
              <span className="mr-1 text-xs">发送中</span>
              <svg
                className="animate-spin h-3 w-3 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </>
          ) : (
            "发送"
          )}
        </button>
      </div>
    </div>
  );
}
