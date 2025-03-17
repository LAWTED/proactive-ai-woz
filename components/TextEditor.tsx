"use client";

import React from "react";

interface TextEditorProps {
  value: string;
  onChange: (newText: string) => void;
}

export default function TextEditor({ value, onChange }: TextEditorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="border rounded bg-white shadow-sm h-full">
      <div className="bg-gray-50 border-b p-2 flex items-center">
        <div className="font-medium text-gray-700">Document Editor</div>
      </div>
      <textarea
        className="w-full h-[calc(100vh-12rem)] p-4 focus:outline-none resize-none font-sans ProseMirror"
        value={value}
        onChange={handleChange}
        placeholder="Start typing here..."
      />
    </div>
  );
}