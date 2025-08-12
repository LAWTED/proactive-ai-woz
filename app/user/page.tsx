"use client";

import React, { useState, useEffect, useRef } from "react";
import HighlightTextEditor from "@/components/HighlightTextEditor";
import SuggestionPanel from "@/components/SuggestionPanel";
import { supabase } from "@/lib/supabase";

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
  full_text?: string; // 新字段：完整原文
  reaction?: "like" | "apply" | "reject";
  created_at: string;
}

export default function UserPage() {
  const [text, setText] = useState<string>("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const [existingUsers, setExistingUsers] = useState<{ id: number; name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const positionRecordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textRef = useRef<string>("");

  // 初始化会话 & 获取现有用户
  useEffect(() => {
    // 生成唯一的会话ID
    const newSessionId = `user-${Math.random().toString(36).substring(2, 9)}`;
    setSessionId(newSessionId);

    // 检查本地存储是否有用户信息
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUserName(userData.name);
        setUserId(userData.id);
        setIsRegistered(true);
        fetchUserDocument(userData.id);
      } catch (error) {
        console.error("Error parsing stored user data:", error);
        localStorage.removeItem("user");
        fetchExistingUsers(); // Fetch users if login fails or no stored user
      }
    } else {
      fetchExistingUsers(); // Fetch users if no stored user
    }

    // 组件卸载时清理计时器
    return () => {
      if (positionRecordTimerRef.current) {
        clearInterval(positionRecordTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch existing users from the database
  const fetchExistingUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, name');

      if (error) throw error;

      if (data) {
        setExistingUsers(data);
      }
    } catch (error) {
      console.error('Error fetching existing users:', error);
      alert('无法加载现有用户列表');
    } finally {
      setLoading(false);
    }
  };


  // 每10秒记录用户写作时间快照
  useEffect(() => {
    positionRecordTimerRef.current = setInterval(async () => {
      if (userId && sessionId) { // 确保有用户ID、会话ID时记录
        const now = new Date();

        // 获取当前文本
        const currentText = textRef.current;

        // 计算词数和句子数
        const wordCount = currentText.trim().split(/\s+/).filter(word => word.length > 0).length;
        const sentenceCount = currentText.split(/[。！？!?]/).filter(s => s.trim()).length;

        // 保存到数据库
        try {
          const { error } = await supabase
            .from('writing_snapshots')
            .insert({
              user_id: userId,
              session_id: sessionId,
              timestamp: now.toISOString(),
              text_length: currentText.length,
              word_count: wordCount,
              sentence_count: sentenceCount,
              typing_speed: 0, // 不再实时计算速度，后续可通过快照差值分析
              full_text: currentText // 保存完整文本快照
            });

          if (error) {
            console.error('保存写作快照失败:', error);
          } else {
            console.log(`时间快照已保存: 字符数${currentText.length}, 词数${wordCount}, 句子数${sentenceCount}, 时间: ${now.toISOString()}`);
          }
        } catch (error) {
          console.error('保存写作快照出错:', error);
        }
      }
    }, 10000); // 每10秒记录一次

    return () => {
      if (positionRecordTimerRef.current) {
        clearInterval(positionRecordTimerRef.current);
      }
    };
  }, [userId, sessionId]); // 只依赖userId、sessionId，不依赖text避免频繁重置定时器

  // 设置Supabase订阅
  useEffect(() => {
    if (!userId) return;

    // 获取所有建议
    fetchSuggestions();

    // 设置Supabase实时订阅
    const suggestionsSubscription = supabase
      .channel("suggestions-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "suggestions",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("Suggestion update:", payload);

          // 如果收到新建议或建议状态更新，刷新建议列表
          fetchSuggestions();
        }
      )
      .subscribe();

    // 组件卸载时清理订阅
    return () => {
      suggestionsSubscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // 获取所有建议
  const fetchSuggestions = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("suggestions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        // 处理所有建议
        const allSuggestions = data as Suggestion[];

        // 查找是否有需要在右侧面板显示的append类型建议
        const appendSuggestion = allSuggestions.find(
          (s) =>
            s.type === "append" &&
            s.is_accepted === null &&
            s.reaction === undefined
        );

        if (appendSuggestion) {
          setSuggestion(appendSuggestion);
        } else {
          setSuggestion(null);
        }

        // 设置所有建议用于列表显示
        setSuggestions(allSuggestions);
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  };

  // 获取用户文档
  const fetchUserDocument = async (uid: number) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const content = data[0].content || "";
        setText(content);
        textRef.current = content; // 同步更新ref
        setDocumentId(data[0].id);
      } else {
        // 如果没有文档，创建一个新文档
        createNewDocument(uid);
      }
    } catch (error) {
      console.error("Error fetching document:", error);
    } finally {
      setLoading(false);
    }
  };

  // 创建新文档
  const createNewDocument = async (uid: number) => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .insert([
          {
            content: "",
            user_id: uid,
          },
        ])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setDocumentId(data[0].id);
      }
    } catch (error) {
      console.error("Error creating document:", error);
    }
  };

  // 处理用户登录或注册
  const handleLoginOrRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userName.trim()) {
      alert("请输入或选择一个名字");
      return;
    }

    setLoading(true);

    try {
      // 优先使用selectedUserId（从下拉列表选择的用户）
      let existingUser = null;
      if (selectedUserId) {
        existingUser = existingUsers.find(u => u.id === selectedUserId);
      } else {
        // 如果没有选择用户ID，则通过名字匹配查找
        existingUser = existingUsers.find(u => u.name === userName.trim());
      }

      if (existingUser) {
        // 用户存在，执行登录逻辑
        setUserId(existingUser.id);
        setIsRegistered(true);

        // 更新本地存储
        localStorage.setItem(
          "user",
          JSON.stringify({
            id: existingUser.id,
            name: existingUser.name, // 使用数据库中的名字，确保一致性
            session_id: sessionId, // Update session ID for existing user login
          })
        );

        // 获取用户文档
        fetchUserDocument(existingUser.id);
        console.log(`用户 ${existingUser.name} (ID: ${existingUser.id}) 登录成功`);

      } else {
        // 用户不存在，执行注册逻辑
        const { data, error } = await supabase
          .from("users")
          .insert([
            {
              name: userName.trim(),
              session_id: sessionId,
            },
          ])
          .select();

        if (error) throw error;

        if (data && data.length > 0) {
          const newUser = data[0];
          setUserId(newUser.id);
          setIsRegistered(true);

          // 保存新用户信息到本地存储
          localStorage.setItem(
            "user",
            JSON.stringify({
              id: newUser.id,
              name: userName.trim(),
              session_id: sessionId,
            })
          );

          // 添加新用户到现有用户列表（用于下次显示）
          setExistingUsers(prev => [...prev, { id: newUser.id, name: userName.trim() }]);

          // 创建新文档
          createNewDocument(newUser.id);
          console.log(`新用户 ${userName} 注册成功`);
        }
      }
    } catch (error) {
      console.error("Error logging in or registering user:", error);
      alert("登录或注册失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  // 处理文本变更
  const handleTextChange = (newText: string) => {
    setText(newText);
    textRef.current = newText; // 同步更新ref

    // 更新文档内容
    if (documentId && userId) {
      updateDocument(newText);
    }
  };


  // 更新文档
  const updateDocument = async (content: string) => {
    try {
      const { error } = await supabase
        .from("documents")
        .update({
          content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating document:", error);
    }
  };

  // 处理添加类型建议的接受
  const handleAcceptSuggestion = async (id: number) => {
    const suggestionToAccept = suggestions.find((s) => s.id === id);
    if (!suggestionToAccept) return;

    try {
      // 更新建议状态
      const { error: updateError } = await supabase
        .from("suggestions")
        .update({
          is_accepted: true,
          reaction: "apply",
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // 如果是添加类型的建议，更新文本
      if (suggestionToAccept.type === "append") {
        const newText = text + suggestionToAccept.content;
        setText(newText);
        updateDocument(newText);

        // 接受建议的操作已通过suggestion状态更新记录
      }

      // 刷新建议列表
      fetchSuggestions();
    } catch (error) {
      console.error("Error updating suggestion status:", error);
    }
  };

  // 处理部分接受
  const handlePartialAccept = async (id: number, partialText: string) => {
    const suggestionToAccept = suggestions.find((s) => s.id === id);
    if (!suggestionToAccept) return;

    try {
      // 更新建议状态
      const { error: updateError } = await supabase
        .from("suggestions")
        .update({
          is_accepted: true,
          reaction: "apply",
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // 更新文本（只适用于添加类型）
      if (suggestionToAccept.type === "append") {
        const newText = text + partialText;
        setText(newText);
        updateDocument(newText);

        // 部分接受建议的操作已通过suggestion状态更新记录
      }

      // 刷新建议列表
      fetchSuggestions();
    } catch (error) {
      console.error("Error updating suggestion status:", error);
    }
  };

  // 处理拒绝建议
  const handleRejectSuggestion = async (id: number) => {
    try {
      const suggestionToReject = suggestions.find((s) => s.id === id);
      if (!suggestionToReject) return;

      const { error } = await supabase
        .from("suggestions")
        .update({
          is_accepted: false,
          reaction: "reject",
        })
        .eq("id", id);

      if (error) throw error;

      // 拒绝建议的操作已通过suggestion状态更新记录

      // 刷新建议列表
      fetchSuggestions();
    } catch (error) {
      console.error("Error rejecting suggestion:", error);
    }
  };

  // 处理建议点赞
  const handleLikeSuggestion = async (id: number) => {
    try {
      const suggestionToLike = suggestions.find((s) => s.id === id);
      if (!suggestionToLike) return;

      const { error } = await supabase
        .from("suggestions")
        .update({
          reaction: "like",
        })
        .eq("id", id);

      if (error) throw error;

      // 点赞建议的操作已通过suggestion状态更新记录

      // 刷新建议列表
      fetchSuggestions();
    } catch (error) {
      console.error("Error liking suggestion:", error);
    }
  };

  // 应用文本修改
  const applyTextModification = async (suggestion: Suggestion) => {
    if (!suggestion.content) return;

    try {
      // 更新文本
      let newText = text;

      if (suggestion.type === "comment" && suggestion.selected_text) {
        // 对于修改类型建议，替换选中的文本
        if (suggestion.position !== undefined) {
          if (suggestion.end_position !== undefined) {
            newText =
              text.substring(0, suggestion.position) +
              suggestion.content +
              text.substring(suggestion.end_position);
          } else {
            // 如果没有结束位置，则只在位置插入内容
            newText =
              text.substring(0, suggestion.position) +
              suggestion.content +
              text.substring(suggestion.position);
          }
        }
      } else if (suggestion.type === "append") {
        // 对于添加类型建议，将内容添加到文本末尾
        newText = text + suggestion.content;
      }

      // 更新文本和数据库
      setText(newText);
      updateDocument(newText);

      // 应用修改的操作已通过suggestion状态更新记录

      // 更新建议状态
      const { error } = await supabase
        .from("suggestions")
        .update({
          reaction: "apply",
          is_accepted: true,
        })
        .eq("id", suggestion.id);

      if (error) throw error;

      // 刷新建议列表
      fetchSuggestions();
    } catch (error) {
      console.error("Error applying text modification:", error);
    }
  };

  // 高亮显示建议位置
  const highlightSuggestionPosition = (suggestion: Suggestion) => {
    console.log("highlightSuggestionPosition", suggestion);

    // 如果有选中文本，设置为activeHighlight，否则清除高亮
    if (suggestion.selected_text) {
      setActiveHighlight(suggestion.selected_text);
    } else {
      // 清除高亮（当鼠标移开时）
      setActiveHighlight(null);
    }
  };




  // 处理登出
  const handleLogout = () => {
    // 清除状态
    setUserName("");
    setUserId(null);
    setSelectedUserId(null); // 清除选中的用户ID
    setIsRegistered(false);
    setDocumentId(null);
    setText("");
    setSuggestions([]);
    setSuggestion(null);
    setActiveHighlight(null);

    // 清除本地存储
    localStorage.removeItem("user");

    // 清理计时器
    if (positionRecordTimerRef.current) {
      clearInterval(positionRecordTimerRef.current);
    }
  };

  // 登录表单
  const renderLoginForm = () => (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">开始写作</h1>
          <p className="mt-2 text-gray-600">请输入您的名字以开始写作，或选择现有用户</p>
        </div>

        <form onSubmit={handleLoginOrRegister} className="mt-8 space-y-6">
          {/* Existing User Selection Dropdown */}
          {existingUsers.length > 0 && (
            <div>
              <label htmlFor="existing-user" className="block text-sm font-medium text-gray-700">
                选择现有用户
              </label>
              <div className="mt-1">
                <select
                  id="existing-user"
                  name="existing-user"
                  onChange={(e) => {
                    const selectedUserIdStr = e.target.value;
                    if (selectedUserIdStr) {
                      const selectedUserId = parseInt(selectedUserIdStr);
                      const selectedUser = existingUsers.find(u => u.id === selectedUserId);
                      if (selectedUser) {
                        setSelectedUserId(selectedUserId);
                        setUserName(selectedUser.name);
                      }
                    } else {
                      setSelectedUserId(null);
                      setUserName(""); // Clear name if default option selected
                    }
                  }}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- 选择用户 --</option>
                  {existingUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} (ID: {user.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Name Input */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              您的名字
            </label>
            <div className="mt-1">
              <input
                id="name"
                name="name"
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入您的名字"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {loading ? "处理中..." : "开始写作"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // 编辑器界面
  const renderEditor = () => (
    <div className="flex min-h-screen flex-col">
      <header className="p-4 bg-blue-600 text-white">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">
            Document Editor - 欢迎, {userName}
          </h1>
          <div className="flex items-center space-x-4">
            <div className="bg-blue-700 px-3 py-1 rounded">
              <span className="text-sm">文本长度: {text.length}</span>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white text-sm py-1 px-3 rounded transition-colors"
            >
              切换/新用户
            </button>
          </div>
        </div>
      </header>


      <main className="flex flex-1 p-8">
        <div className="flex-1 mr-4 px-20">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p>加载数据中...</p>
            </div>
          ) : (
            <div>
              <HighlightTextEditor
                content={text}
                onContentChange={handleTextChange}
                activeHighlight={activeHighlight || undefined}
              />
            </div>
          )}
        </div>

        <div className="w-96 border-l pl-4">
          <SuggestionPanel
            suggestions={suggestions}
            activeSuggestion={suggestion}
            onAccept={handleAcceptSuggestion}
            onPartialAccept={handlePartialAccept}
            onReject={handleRejectSuggestion}
            onApply={applyTextModification}
            onLike={handleLikeSuggestion}
            onRejectSuggestion={handleRejectSuggestion}
            onHighlight={highlightSuggestionPosition}
          />
        </div>
      </main>

      <footer className="p-4 bg-gray-100 text-center text-gray-500 text-sm">
        Session ID: {sessionId} | 文本长度: {text.length} 字符
      </footer>
    </div>
  );

  return isRegistered ? renderEditor() : renderLoginForm();
}
