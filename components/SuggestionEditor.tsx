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
  isSending = false
}: SuggestionEditorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send suggestion on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isSending) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border rounded p-4 bg-white">
      <h2 className="font-bold mb-2">Create Suggestion</h2>

      <div className="mb-4">
        <textarea
          className="w-full h-40 p-3 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Write a suggestion that would help the user..."
          disabled={isSending}
        />
        <p className="text-xs text-gray-500 mt-1">Press Ctrl+Enter or Cmd+Enter to send</p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onSend}
          disabled={!value.trim() || isSending}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {isSending ? (
            <>
              <span className="mr-2">发送中...</span>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </>
          ) : (
            "发送建议"
          )}
        </button>
      </div>
    </div>
  );
}