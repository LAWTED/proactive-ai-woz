"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import SuggestionEditor from "@/components/SuggestionEditor";

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

export default function WizardPage() {
  const [userText, setUserText] = useState<string>("");
  const [suggestion, setSuggestion] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sentSuggestions, setSentSuggestions] = useState<Suggestion[]>([]);
  const [suggestionType, setSuggestionType] = useState<"append" | "comment">(
    "append"
  );
  const [isSelectingText, setIsSelectingText] = useState<boolean>(false);
  const [selectedTextPosition, setSelectedTextPosition] = useState<
    number | null
  >(null);
  const [selectedTextEndPosition, setSelectedTextEndPosition] = useState<
    number | null
  >(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);

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
    setIsSelectingText(false);
    setSelectedTextPosition(null);
    setSelectedTextEndPosition(null);
    setSelectedText("");
    setSuggestionType("append");
  };

  // 更新建议内容
  const handleSuggestionChange = (newSuggestion: string) => {
    setSuggestion(newSuggestion);
  };

  // 处理文本选择
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const startOffset = range.startOffset;
      const endOffset = range.endOffset;

      // 确保有选择文本
      if (startOffset !== endOffset) {
        const selectedContent = selection.toString();

        // 设置选择文本的信息
        setSelectedTextPosition(startOffset);
        setSelectedTextEndPosition(endOffset);
        setSelectedText(selectedContent);

        // 自动切换到修改模式
        setSuggestionType("comment");

        // 自动打开选择模式
        setIsSelectingText(true);
      } else if (selectedText) {
        // 如果是清空选择，自动切换回添加模式
        resetSelectionState();
      }
    }
  };

  // 取消文本选择
  const handleCancelSelect = () => {
    resetSelectionState();
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

      // 如果是评论类型，添加位置和选择的文本信息
      if (suggestionType === "comment") {
        if (selectedTextPosition !== null) {
          suggestionData.position = selectedTextPosition;

          if (selectedTextEndPosition !== null) {
            suggestionData.end_position = selectedTextEndPosition;
          }

          if (selectedText) {
            suggestionData.selected_text = selectedText;
          }
        }
      }

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

  // 切换模式 Switch
  const toggleModeSwitch = () => {
    if (isSelectingText) {
      // 关闭选择模式
      resetSelectionState();
    } else {
      // 打开选择模式
      setIsSelectingText(true);
    }
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
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
          添加
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
          修改
        </span>
      );
    }
  };

  // Switch 组件
  const Switch = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: () => void;
  }) => (
    <div
      className={`relative inline-block w-12 h-6 rounded-full cursor-pointer transition-colors ${
        checked ? "bg-yellow-400" : "bg-purple-400"
      }`}
      onClick={onChange}
    >
      <span
        className={`block w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ease-in-out transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
        style={{ marginTop: "2px" }}
      />
      <span className="sr-only">切换模式</span>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="p-4 bg-purple-700 text-white">
        <h1 className="text-xl font-bold">Wizard Control Panel</h1>
      </header>

      <main className="flex flex-1">
        <div className="w-64 bg-gray-100 p-4">
          <h2 className="font-bold mb-4">在线用户</h2>
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
                  <div className="text-xs text-gray-500">{user.session_id}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">无在线用户</p>
          )}
        </div>

        <div className="flex-1 p-4">
          {selectedUser ? (
            <>
              <div className="mb-4">
                <h2 className="font-bold mb-2">
                  用户内容 - {selectedUser.name}
                </h2>
                {isSelectingText && (
                  <div className="mb-2 flex items-center text-sm">
                    <span className="text-blue-600 font-medium">
                      请选择要修改的文本范围
                    </span>
                    <button
                      onClick={handleCancelSelect}
                      className="ml-2 text-red-600 hover:underline"
                    >
                      取消
                    </button>
                  </div>
                )}
                <div
                  className={`p-4 border rounded bg-white min-h-32 whitespace-pre-wrap cursor-text`}
                  onMouseUp={handleTextSelection}
                >
                  {userText}
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center mb-2 justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {suggestionType === "append" ? "添加模式" : "修改模式"}
                    </span>
                    <Switch
                      checked={isSelectingText}
                      onChange={toggleModeSwitch}
                    />
                  </div>

                  {suggestionType === "comment" && selectedText && (
                    <div className="flex items-center">
                      <span className="text-sm text-gray-600 mr-1">
                        已选择:
                      </span>
                      <span className="font-medium bg-yellow-50 px-1 py-0.5 rounded border border-yellow-200 max-w-md overflow-hidden text-ellipsis">
                        {selectedText}
                      </span>
                    </div>
                  )}
                </div>

                {suggestionType === "comment" && selectedText && (
                  <div className="mb-2 text-sm text-gray-500">
                    请提供针对&ldquo;{selectedText}&rdquo;的修改建议
                  </div>
                )}
              </div>

              <SuggestionEditor
                value={suggestion}
                onChange={handleSuggestionChange}
                onSend={handleSendSuggestion}
                isSending={isSending}
              />

              {/* 建议历史记录 */}
              <div className="mt-6">
                <h3 className="font-medium text-gray-700 mb-2">
                  发送的建议历史
                </h3>
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

                        {item.type === "comment" && item.selected_text && (
                          <div className="mb-2">
                            <div className="text-xs text-gray-500 mb-1">
                              原文:
                            </div>
                            <div className="bg-gray-100 p-2 rounded text-sm text-gray-700 font-mono">
                              {item.selected_text}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col">
                          <div className="text-xs text-gray-500 mb-1">
                            建议:
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
            </>
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
