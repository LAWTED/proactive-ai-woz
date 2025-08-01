"use client";

import React, { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import SuggestionEditor from "@/components/SuggestionEditor";
import DeepSeekSuggestion from "@/components/DeepSeekSuggestion";
import DeepSeekFeedback from "@/components/DeepSeekFeedback";
import { useSearchParams } from "next/navigation";

// 添加自定义滚动条样式
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #c5c5c5;
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
`;

// 定义数据类型
interface User {
  id: number;
  name: string;
  session_id: string;
  created_at: string;
}

interface Suggestion {
  id: number;
  content: string;
  wizard_session_id: string;
  user_id: number;
  is_accepted: boolean | null;
  type: "append" | "comment";
  position?: number;
  end_position?: number;
  selected_text?: string;
  reaction?: "like" | "apply" | "reject";
  created_at: string;
}

// payload类型定义
interface DocumentPayload {
  new: {
    content?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// 建议数据接口
interface SuggestionData {
  content: string;
  user_id: number;
  wizard_session_id: string;
  type: "append" | "comment";
  position?: number;
  end_position?: number;
  selected_text?: string;
}

function WizardContent() {
  const searchParams = useSearchParams();
  const [userText, setUserText] = useState<string>("");
  const [suggestion, setSuggestion] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sentSuggestions, setSentSuggestions] = useState<Suggestion[]>([]);

  // Get suggestion type from URL parameters, default to "append"
  const suggestionType = (
    searchParams.get("mode") === "comment" ? "comment" : "append"
  ) as "append" | "comment";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedText, setSelectedText] = useState<string>(""); // 保留用于向后兼容，虽然评论模式不再使用
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showUserList, setShowUserList] = useState<boolean>(true);

  // 获取所有用户
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        setActiveUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  // 获取指定用户的文档内容
  const fetchUserDocument = async (userId: number) => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setUserText(data[0].content || "");
      } else {
        setUserText("该用户还没有创建文档");
      }
    } catch (error) {
      console.error("Error fetching user document:", error);
    }
  };

  // 获取发送给当前用户的建议
  const fetchSuggestions = async (userId: number) => {
    try {
      const { data, error } = await supabase
        .from("suggestions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        setSentSuggestions(data);
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  };

  // 初始化
  useEffect(() => {
    // 生成巫师会话ID
    const wizardSessionId = `wizard-${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    setSessionId(wizardSessionId);

    // 获取所有用户
    fetchUsers();

    // 设置用户表实时订阅
    const usersChannel = supabase.channel("users-changes");

    usersChannel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          fetchUsers(); // 当用户表发生变化时，重新获取用户列表
        }
      )
      .subscribe();

    // 组件卸载时清理订阅
    return () => {
      usersChannel.unsubscribe();
    };
  }, []);

  // 文档内容实时订阅
  useEffect(() => {
    if (!selectedUser) return;

    // 先获取一次当前选定用户的文档
    fetchUserDocument(selectedUser.id);

    // 获取发送给当前用户的建议
    fetchSuggestions(selectedUser.id);

    // 设置文档表实时订阅
    const documentsChannel = supabase.channel("documents-changes");

    documentsChannel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `user_id=eq.${selectedUser.id}`,
        },
        (payload: DocumentPayload) => {
          console.log("Document update:", payload);

          // 更新显示的内容
          if (payload.new && payload.new.content) {
            setUserText(payload.new.content);
          }
        }
      )
      .subscribe();

    // 设置建议表实时订阅
    const suggestionsChannel = supabase.channel("suggestions-changes");

    suggestionsChannel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "suggestions",
          filter: `user_id=eq.${selectedUser.id}`,
        },
        () => {
          // 当建议表发生变化时，重新获取建议列表
          fetchSuggestions(selectedUser.id);
        }
      )
      .subscribe();

    // 组件卸载时清理订阅
    return () => {
      documentsChannel.unsubscribe();
      suggestionsChannel.unsubscribe();
    };
  }, [selectedUser]);

  // 选择用户
  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    // 重置文本选择状态
    resetSelectionState();
  };

  // 重置选择状态
  const resetSelectionState = () => {
    setSelectedText("");
  };

  // 更新建议内容
  const handleSuggestionChange = (newSuggestion: string) => {
    setSuggestion(newSuggestion);
  };



  // 发送建议
  const handleSendSuggestion = async () => {
    if (!selectedUser || !suggestion.trim() || isSending) return;

    try {
      // 设置发送状态为true，防止重复提交
      setIsSending(true);

      // 准备建议数据
      const suggestionData: SuggestionData = {
        content: suggestion,
        user_id: selectedUser.id,
        wizard_session_id: sessionId,
        type: suggestionType,
      };

      // 评论类型建议不再需要位置信息，因为它们是对整体内容的评论

      // 将建议保存到数据库
      const { data, error } = await supabase
        .from("suggestions")
        .insert([suggestionData])
        .select();

      if (error) throw error;

      console.log(
        `Sending ${suggestionType} to ${selectedUser.name}:`,
        suggestion
      );

      // 如果成功，刷新建议列表
      if (data) {
        fetchSuggestions(selectedUser.id);
      }

      // 清空建议字段和重置状态
      setSuggestion("");
      resetSelectionState();
    } catch (error) {
      console.error("Error sending suggestion:", error);
    } finally {
      // 完成后，无论成功失败都重置发送状态
      setIsSending(false);
    }
  };

  const handleApplyDeepSeekSuggestion = (suggestion: string) => {
    setSuggestion(suggestion);
  };

  const handleApplyDeepSeekComment = (suggestion: string) => {
    setSuggestion(suggestion);
  };

  // 渲染建议状态标签
  const renderStatusBadge = (suggestion: Suggestion) => {
    if (suggestion.is_accepted === true) {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
          已接受
        </span>
      );
    } else if (suggestion.is_accepted === false) {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
          已拒绝
        </span>
      );
    } else if (suggestion.reaction === "like") {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
          已点赞
        </span>
      );
    } else if (suggestion.reaction === "apply") {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
          已应用
        </span>
      );
    } else if (suggestion.reaction === "reject") {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
          已拒绝
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
          等待中
        </span>
      );
    }
  };

  // 渲染建议类型标签
  const renderTypeBadge = (type: "append" | "comment") => {
    if (type === "append") {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
          补全
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
          建议
        </span>
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <style jsx global>
        {scrollbarStyles}
      </style>
      <header className="p-4 bg-purple-700 text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Wizard Control Panel</h1>
          <div className="flex items-center space-x-2">
            <span className="text-sm opacity-75">模式:</span>
            <span
              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                suggestionType === "append"
                  ? "bg-blue-600 text-white"
                  : "bg-red-500 text-white"
              }`}
            >
              {suggestionType === "append" ? "补全" : "建议"}
            </span>
          </div>
        </div>
      </header>

      <main className="flex flex-1">
        <div
          className={`bg-gray-100 transition-all duration-300 ${
            showUserList ? "w-64" : "w-12"
          }`}
        >
          <div className="flex items-center justify-between p-4">
            <h2 className={`font-bold ${showUserList ? "visible" : "hidden"}`}>
              在线用户
            </h2>
            <button
              onClick={() => setShowUserList(!showUserList)}
              className="p-1 rounded-full hover:bg-gray-200"
              title={showUserList ? "收起用户列表" : "展开用户列表"}
            >
              {showUserList ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          </div>

          <div className={`px-4 pb-4 ${showUserList ? "block" : "hidden"}`}>
            {loading ? (
              <p className="text-gray-500">加载中...</p>
            ) : activeUsers.length > 0 ? (
              <ul className="space-y-2">
                {activeUsers.map((user) => (
                  <li
                    key={user.id}
                    className={`p-2 rounded cursor-pointer ${
                      selectedUser?.id === user.id
                        ? "bg-blue-200"
                        : "hover:bg-gray-200"
                    }`}
                    onClick={() => handleUserSelect(user)}
                  >
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-gray-500">
                      {user.session_id}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">无在线用户</p>
            )}
          </div>
        </div>

        <div className="flex-1 p-4">
          {selectedUser ? (
            <div className="flex flex-1 gap-4">
              {/* 左侧：用户内容 */}
              <div className="w-1/2">
                <h2 className="font-bold mb-2">
                  用户内容 - {selectedUser.name}
                </h2>
                <div
                  className={`p-4 border rounded bg-white min-h-[calc(100vh-240px)] whitespace-pre-wrap overflow-y-auto custom-scrollbar`}
                >
                  <div className="mb-[100vh]">{userText}</div>
                </div>
              </div>

              {/* 右侧：操作区域 */}
              <div className="w-1/2">
                <div className="sticky top-16 pb-4">
                  <div className="mb-4">
                    <div className="flex items-center mb-2 justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600 font-medium">
                          当前模式:{" "}
                          {suggestionType === "append"
                            ? "补全模式"
                            : "建议模式"}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            suggestionType === "append"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {suggestionType === "append" ? "补全" : "建议"}
                        </span>
                      </div>
                    </div>


                  </div>

                  <div className="relative">
                    {suggestionType === "append" ? (
                      <DeepSeekSuggestion
                        content={userText}
                        onApply={handleApplyDeepSeekSuggestion}
                        wizardSessionId={sessionId}
                        userId={selectedUser?.id}
                      />
                    ) : (
                      <DeepSeekFeedback
                        content={userText}
                        onApply={handleApplyDeepSeekComment}
                        wizardSessionId={sessionId}
                        userId={selectedUser?.id}
                      />
                    )}
                    <SuggestionEditor
                      value={suggestion}
                      onChange={handleSuggestionChange}
                      onSend={handleSendSuggestion}
                      isSending={isSending}
                    />
                  </div>

                  {/* 建议历史记录 */}
                  <div className="mt-6 bg-white rounded-lg p-4 shadow-sm">
                    <h3 className="font-medium text-gray-700 mb-2">
                      发送的建议历史
                    </h3>
                    <div className="max-h-[calc(100vh-650px)] overflow-y-auto pr-2 custom-scrollbar">
                      {sentSuggestions.length > 0 ? (
                        <div className="space-y-3">
                          {sentSuggestions.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 border rounded bg-gray-50 hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center space-x-2">
                                  <div className="text-sm text-gray-500">
                                    {new Date(item.created_at).toLocaleString()}
                                  </div>
                                  {renderTypeBadge(item.type)}
                                </div>
                                {renderStatusBadge(item)}
                              </div>

                              {item.selected_text && (
                                  <div className="mb-2">
                                    <div className="text-xs text-gray-500 mb-1">
                                      {item.type === "comment" ? "针对内容:" : "基于原文:"}
                                    </div>
                                    <div className="bg-gray-100 p-2 rounded text-sm text-gray-700 font-mono">
                                      &ldquo;{item.selected_text}&rdquo;
                                    </div>
                                  </div>
                                )}

                              <div className="flex flex-col">
                                <div className="text-xs text-gray-500 mb-1">
                                  {item.type === "append" ? "补全:" : "建议:"}
                                </div>
                                <div className="text-gray-700 whitespace-pre-wrap text-sm bg-white p-2 rounded border">
                                  {item.content}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500">暂无发送给该用户的建议</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              请从左侧选择一个用户来查看其内容并提供建议
            </div>
          )}
        </div>
      </main>

      <footer className="p-4 bg-gray-100 text-center text-gray-500 text-sm">
        Wizard Session ID: {sessionId}
      </footer>
    </div>
  );
}

// Loading component for Suspense fallback
function WizardPageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-gray-500">Loading wizard...</div>
    </div>
  );
}

export default function WizardPage() {
  return (
    <Suspense fallback={<WizardPageLoading />}>
      <WizardContent />
    </Suspense>
  );
}
