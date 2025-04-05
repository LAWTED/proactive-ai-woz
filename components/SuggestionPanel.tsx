"use client";

import React, { useState } from "react";

interface Suggestion {
  id: number;
  content: string;
  wizard_session_id: string;
  user_id: number;
  is_accepted: boolean | null;
  type: 'append' | 'comment';
  position?: number;
  end_position?: number;
  selected_text?: string;
  reaction?: 'like' | 'apply' | 'reject';
  created_at: string;
}

interface SuggestionPanelProps {
  // 传入所有建议数据
  suggestions: Suggestion[];
  // 当前活跃的添加建议（右上角显示）
  activeSuggestion: Suggestion | null;
  // 处理添加建议的接受操作
  onAccept: (id: number) => void;
  onPartialAccept: (id: number, text: string) => void;
  onReject: (id: number) => void;
  // 处理所有建议的通用操作
  onApply: (suggestion: Suggestion) => void;
  onLike: (id: number) => void;
  onRejectSuggestion: (id: number) => void;
  // 高亮显示建议位置
  onHighlight: (suggestion: Suggestion) => void;
}

export default function SuggestionPanel({
  suggestions,
  activeSuggestion,
  onAccept,
  onPartialAccept,
  onReject,
  onApply,
  onLike,
  onRejectSuggestion,
  onHighlight
}: SuggestionPanelProps) {
  const [editedSuggestion, setEditedSuggestion] = useState<string>("");

  // 当有新的活跃建议时，更新编辑区域
  React.useEffect(() => {
    if (activeSuggestion) {
      setEditedSuggestion(activeSuggestion.content);
    }
  }, [activeSuggestion]);

  const handleEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedSuggestion(e.target.value);
  };

  const handlePartialAccept = () => {
    if (activeSuggestion) {
      onPartialAccept(activeSuggestion.id, editedSuggestion);
    }
  };

  // 渲染建议状态标签
  const renderStatusBadge = (suggestion: Suggestion) => {
    if (suggestion.reaction === 'apply' || suggestion.is_accepted === true) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">已应用</span>;
    } else if (suggestion.reaction === 'like') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">已点赞</span>;
    } else if (suggestion.reaction === 'reject' || suggestion.is_accepted === false) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">已拒绝</span>;
    }
    return null;
  };

  // 获取未处理的建议的数量
  const pendingCount = suggestions.filter(s => !s.reaction && !s.is_accepted).length;

  return (
    <div className="h-full flex flex-col overflow-auto">
      <h2 className="font-bold mb-4 flex items-center justify-between">
        <span>AI 建议</span>
        {pendingCount > 0 && (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-500 text-white">
            {pendingCount} 条未处理
          </span>
        )}
      </h2>

      {/* 活跃建议面板（仅添加类型） */}
      {activeSuggestion && (
        <div className="border rounded p-3 mb-4 bg-blue-50">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">添加</span>
            <span className="text-xs text-gray-500">{new Date(activeSuggestion.created_at).toLocaleString()}</span>
          </div>
          <textarea
            className="w-full h-40 p-2 border rounded mb-3 bg-white"
            value={editedSuggestion}
            onChange={handleEditChange}
          />

          <div className="flex justify-between">
            <button
              onClick={() => onReject(activeSuggestion.id)}
              className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100"
            >
              拒绝
            </button>

            <div className="space-x-2">
              <button
                onClick={handlePartialAccept}
                className="px-3 py-1 bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-50"
                disabled={!editedSuggestion.trim()}
              >
                部分接受
              </button>

              <button
                onClick={() => onAccept(activeSuggestion.id)}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                全部接受
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 所有建议列表 */}
      <div className="space-y-4 overflow-y-auto">
        {suggestions.length > 0 ? (
          suggestions.map(item => (
            <div key={item.id} className="p-3 border rounded bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center space-x-2">
                  {item.type === 'append' ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">添加</span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">修改</span>
                  )}
                  <div className="text-xs text-gray-500">
                    {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>
                {renderStatusBadge(item)}
              </div>

              {/* 修改建议显示原文 */}
              {item.type === 'comment' && item.selected_text && (
                <div className="mb-2 flex items-start">
                  <div className="flex-grow">
                    <div className="text-xs text-gray-500 mb-1">原文:</div>
                    <div className="bg-gray-100 p-2 rounded text-sm text-gray-700 font-mono relative">
                      {item.selected_text}
                      <div
                        onMouseEnter={() => onHighlight(item)}
                        onMouseLeave={() => onHighlight({ ...item, selected_text: "" })}
                        className="absolute top-1 right-1 text-blue-600 hover:text-blue-800 cursor-pointer"
                        title="悬停查看在文档中的位置"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 建议内容 */}
              <div className="flex flex-col">
                <div className="text-xs text-gray-500 mb-1">建议:</div>
                <div className="text-gray-700 whitespace-pre-wrap text-sm bg-white p-2 rounded border">
                  {item.content}
                </div>
              </div>

              {/* 未处理建议的操作按钮 */}
              {!item.reaction && !item.is_accepted && (
                <div className="flex space-x-2 mt-3">
                  <button
                    onClick={() => onApply(item)}
                    className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    应用
                  </button>
                  <button
                    onClick={() => onLike(item.id)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    点赞
                  </button>
                  <button
                    onClick={() => onRejectSuggestion(item.id)}
                    className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    拒绝
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 italic p-4">
            暂无AI建议
          </div>
        )}
      </div>
    </div>
  );
}