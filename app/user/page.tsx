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
  const [typingSpeed, setTypingSpeed] = useState<number>(0);
  const [typingHistory, setTypingHistory] = useState<{time: number, length: number}[]>([]);
  const [typingSpeedRecords, setTypingSpeedRecords] = useState<{
    timestamp: string,
    speed: number,
    action?: {
      type: 'A' | 'F',
      operation: 'apply' | 'like' | 'reject',
      suggestionId?: number
    }
  }[]>([]);
  const [showTypingChart, setShowTypingChart] = useState<boolean>(false);
  const [existingUsers, setExistingUsers] = useState<{ id: number; name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [writingPositionRecords, setWritingPositionRecords] = useState<{
    timestamp: string,
    textLength: number,
    lastSentence: string,
    wordCount: number
  }[]>([]);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingRecordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const positionRecordTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      if (typingRecordTimerRef.current) {
        clearInterval(typingRecordTimerRef.current);
      }
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

  // 监控打字速度并记录
  useEffect(() => {
    // 启动定时记录打字速度的计时器（每1秒记录一次，无论是否打字）
    typingRecordTimerRef.current = setInterval(() => {
      const now = new Date();
      // 记录当前时间点的打字速度，即使是0
      setTypingSpeedRecords(prev => [...prev, {
        timestamp: now.toISOString(),
        speed: typingSpeed
      }]);

      // 控制记录的总数量，防止内存占用过大
      setTypingSpeedRecords(prev => {
        if (prev.length > 3600) { // 最多保留1小时的数据(3600秒)
          return prev.slice(-1800); // 保留最近半小时
        }
        return prev;
      });

      if (typingSpeed > 0) {
        console.log(`记录打字速度: ${typingSpeed} 字符/分钟, 时间: ${now.toISOString()}`);
      }
    }, 1000); // 改为每秒记录一次

    return () => {
      if (typingRecordTimerRef.current) {
        clearInterval(typingRecordTimerRef.current);
      }
    };
  }, [typingSpeed]); // 添加typingSpeed作为依赖项

  // 每10秒记录用户写作时间快照
  useEffect(() => {
    positionRecordTimerRef.current = setInterval(async () => {
      if (userId && sessionId && text.length > 0) { // 确保有用户ID、会话ID且有文本时记录
        const now = new Date();
        
        // 获取最后一句话作为位置标识
        let lastSentence = '';
        const sentences = text.split(/[。！？!?]/).filter(s => s.trim());
        if (sentences.length > 0) {
          lastSentence = sentences[sentences.length - 1].trim().substring(0, 20); // 取最后一句的前20个字符
        } else {
          // 如果没有句号，取最后20个字符
          lastSentence = text.slice(-20);
        }
        
        // 计算词数和句子数
        const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
        const sentenceCount = text.split(/[。！？!?]/).filter(s => s.trim()).length;
        
        // 保存到本地状态（用于图表显示）
        const positionRecord = {
          timestamp: now.toISOString(),
          textLength: text.length,
          lastSentence: lastSentence,
          wordCount: wordCount
        };
        
        setWritingPositionRecords(prev => {
          const newRecords = [...prev, positionRecord];
          // 保留最近1小时的记录 (360条记录，每10秒一条)
          if (newRecords.length > 360) {
            return newRecords.slice(-180); // 保留最近半小时
          }
          return newRecords;
        });
        
        // 保存到数据库
        try {
          const { error } = await supabase
            .from('writing_snapshots')
            .insert({
              user_id: userId,
              session_id: sessionId,
              timestamp: now.toISOString(),
              text_length: text.length,
              word_count: wordCount,
              sentence_count: sentenceCount,
              last_sentence: lastSentence,
              typing_speed: typingSpeed,
              full_text: text // 保存完整文本快照
            });

          if (error) {
            console.error('保存写作快照失败:', error);
          } else {
            console.log(`时间快照已保存: 字符数${text.length}, 词数${wordCount}, 句子数${sentenceCount}, 速度${typingSpeed}, 时间: ${now.toISOString()}`);
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
  }, [text, userId, sessionId, typingSpeed]); // 依赖text、userId、sessionId和typingSpeed

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
        setText(data[0].content || "");
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

    // 更新打字历史，记录当前时间和文本长度
    const now = Date.now();
    setTypingHistory(prev => [...prev, { time: now, length: newText.length }]);

    // 每次输入时重置计时器
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    // 设置新的计时器，在用户停止输入1秒后清零打字速度
    typingTimerRef.current = setTimeout(() => {
      setTypingSpeed(0);
    }, 2000);

    // 计算打字速度 (字符/分钟)
    calculateTypingSpeed();

    // 更新文档内容
    if (documentId && userId) {
      updateDocument(newText);
    }
  };

  // 计算打字速度
  const calculateTypingSpeed = () => {
    const now = Date.now();
    const recentHistory = typingHistory.filter(entry => now - entry.time < 10000); // 只考虑最近10秒的输入

    if (recentHistory.length > 1) {
      const oldestEntry = recentHistory[0];
      const newestEntry = recentHistory[recentHistory.length - 1];
      const elapsedTimeInMinutes = (newestEntry.time - oldestEntry.time) / 60000; // 转换为分钟

      if (elapsedTimeInMinutes > 0) {
        const characterCount = newestEntry.length - oldestEntry.length;
        // 只有字符数有变化时才更新速度
        if (characterCount !== 0) {
          const speed = Math.round(characterCount / elapsedTimeInMinutes);
          setTypingSpeed(speed);

          // 保持历史记录在合理大小
          if (typingHistory.length > 100) {
            setTypingHistory(prev => prev.slice(-50));
          }
        }
      }
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

        // 记录接受建议的操作
        setTypingSpeedRecords(prev => [...prev, {
          timestamp: new Date().toISOString(),
          speed: typingSpeed,
          action: {
            type: 'A',
            operation: 'apply',
            suggestionId: id
          }
        }]);
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

        // 记录部分接受建议的操作
        setTypingSpeedRecords(prev => [...prev, {
          timestamp: new Date().toISOString(),
          speed: typingSpeed,
          action: {
            type: 'A',
            operation: 'apply',
            suggestionId: id
          }
        }]);
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

      // 记录拒绝建议的操作
      setTypingSpeedRecords(prev => [...prev, {
        timestamp: new Date().toISOString(),
        speed: typingSpeed,
        action: {
          type: suggestionToReject.type === "append" ? 'A' : 'F',
          operation: 'reject',
          suggestionId: id
        }
      }]);

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

      // 记录点赞建议的操作
      setTypingSpeedRecords(prev => [...prev, {
        timestamp: new Date().toISOString(),
        speed: typingSpeed,
        action: {
          type: suggestionToLike.type === "append" ? 'A' : 'F',
          operation: 'like',
          suggestionId: id
        }
      }]);

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
      const actionType: 'A' | 'F' = suggestion.type === "append" ? 'A' : 'F';

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

      // 记录应用修改的操作
      setTypingSpeedRecords(prev => [...prev, {
        timestamp: new Date().toISOString(),
        speed: typingSpeed,
        action: {
          type: actionType,
          operation: 'apply',
          suggestionId: suggestion.id
        }
      }]);

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

  // 渲染打字速度图表
  const renderTypingSpeedChart = () => {
    // 获取所有的速度记录，因为我们想显示速度为0的情况
    const records = typingSpeedRecords;

    if (records.length === 0) {
      return <div className="p-4 text-center text-gray-500">暂无打字速度数据（等待记录中...）</div>;
    }

    // 处理可能的数据量过大问题
    // 如果数据点过多，进行采样以提高渲染性能
    let sampledRecords = records;
    if (records.length > 120) { // 如果超过120个点
      const sampleRate = Math.ceil(records.length / 120);
      sampledRecords = records.filter((_, index) => index % sampleRate === 0);

      // 确保包含带有action的记录（用户操作点）
      const actionRecords = records.filter(r => r.action);
      sampledRecords = [...sampledRecords, ...actionRecords].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }

    // 计算图表高度和宽度
    const chartHeight = 200;
    const chartWidth = Math.min(800, window.innerWidth - 100);

    // 查找最大速度值以确定比例
    const maxSpeed = Math.max(...sampledRecords.map(r => r.speed), 10);

    // 生成图表点
    const points = sampledRecords.map((record, index) => {
      const x = (index / (sampledRecords.length - 1 || 1)) * chartWidth;
      const y = chartHeight - (record.speed / (maxSpeed || 1)) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    // 计算时间标签，在x轴显示
    const timeLabels = [];
    if (sampledRecords.length > 1) {
      // 添加起始时间
      const startTime = new Date(sampledRecords[0].timestamp);
      timeLabels.push({
        x: 0,
        label: startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})
      });

      // 中间点时间
      const midIndex = Math.floor(sampledRecords.length / 2);
      const midTime = new Date(sampledRecords[midIndex].timestamp);
      timeLabels.push({
        x: (midIndex / (sampledRecords.length - 1)) * chartWidth,
        label: midTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})
      });

      // 结束时间
      const endTime = new Date(sampledRecords[sampledRecords.length - 1].timestamp);
      timeLabels.push({
        x: chartWidth,
        label: endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})
      });
    }

    // 图例
    const legends = [
      { color: "#3b82f6", label: "打字速度" },
      { color: "#8b5cf6", label: "添加模式 (A)" },
      { color: "#f59e0b", label: "反馈模式 (F)" }
    ];

    // 操作图例
    const operationLegends = [
      { symbol: "●", label: "应用" },
      { symbol: "▲", label: "点赞" },
      { symbol: "■", label: "拒绝" },
    ];

    return (
      <div className="bg-white p-4 rounded-lg shadow-md mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold text-gray-700">打字速度-时间图表</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setTypingSpeedRecords([]); // 清空记录
              }}
              className="text-sm text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded"
            >
              清空数据
            </button>
            <button
              onClick={() => setShowTypingChart(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              关闭
            </button>
          </div>
        </div>

        {/* 图例 */}
        <div className="flex space-x-4 mb-2">
          {legends.map((legend, index) => (
            <div key={index} className="flex items-center">
              <div
                className="w-3 h-3 rounded-full mr-1"
                style={{ backgroundColor: legend.color }}
              ></div>
              <span className="text-xs text-gray-600">{legend.label}</span>
            </div>
          ))}
          <div className="border-l pl-2 ml-2">
            {operationLegends.map((legend, index) => (
              <span key={index} className="text-xs text-gray-600 mr-2">
                {legend.symbol} {legend.label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative" style={{ height: `${chartHeight + 30}px`, width: '100%' }}>
          <svg width="100%" height={chartHeight + 30} className="overflow-visible">
            {/* Y轴刻度 */}
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
              <g key={tick}>
                <line
                  x1="0"
                  y1={chartHeight - tick * chartHeight}
                  x2="100%"
                  y2={chartHeight - tick * chartHeight}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y={chartHeight - tick * chartHeight - 5}
                  fontSize="10"
                  fill="#6b7280"
                >
                  {Math.round(tick * maxSpeed)}
                </text>
              </g>
            ))}

            {/* 时间轴标签 */}
            {timeLabels.map((item, index) => (
              <text
                key={index}
                x={item.x}
                y={chartHeight + 15}
                fontSize="10"
                fill="#6b7280"
                textAnchor={index === 0 ? "start" : index === timeLabels.length - 1 ? "end" : "middle"}
              >
                {item.label}
              </text>
            ))}

            {/* X轴线 */}
            <line
              x1="0"
              y1={chartHeight}
              x2="100%"
              y2={chartHeight}
              stroke="#9ca3af"
              strokeWidth="1"
            />

            {/* 数据线 */}
            <polyline
              points={points}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
            />

            {/* 数据点（包括普通点和操作点） */}
            {sampledRecords.map((record, index) => {
              const x = (index / (sampledRecords.length - 1 || 1)) * chartWidth;
              const y = chartHeight - (record.speed / (maxSpeed || 1)) * chartHeight;

              // 根据操作类型设置不同的样式
              let pointColor = "#3b82f6"; // 默认蓝色
              let pointSize = 3;
              let shape = "circle"; // 默认形状：圆形

              if (record.action) {
                pointSize = 6; // 操作点更大

                if (record.action.type === 'F') {
                  pointColor = "#f59e0b"; // 反馈模式黄色
                } else if (record.action.type === 'A') {
                  pointColor = "#8b5cf6"; // 添加模式紫色
                }

                // 根据操作类型设置不同的形状
                if (record.action.operation === 'like') {
                  shape = "triangle"; // 点赞：三角形
                } else if (record.action.operation === 'reject') {
                  shape = "square"; // 拒绝：方形
                }
              }

              // 只在数据点较少或是操作点时显示
              if (sampledRecords.length < 60 || record.action) {
                if (shape === "circle") {
                  return (
                    <circle
                      key={index}
                      cx={x}
                      cy={y}
                      r={pointSize}
                      fill={pointColor}
                      onMouseEnter={() => {
                        const tooltip = document.getElementById('chart-tooltip');
                        if (tooltip) {
                          tooltip.style.display = 'block';
                          tooltip.style.left = `${x + 10}px`;
                          tooltip.style.top = `${y - 30}px`;

                          let operationText = '';
                          if (record.action) {
                            operationText = `\n模式: ${record.action.type === 'A' ? '添加' : '反馈'}`;
                            operationText += `\n操作: ${
                              record.action.operation === 'apply' ? '应用' :
                              record.action.operation === 'like' ? '点赞' : '拒绝'
                            }`;
                          }

                          tooltip.textContent = `时间: ${new Date(record.timestamp).toLocaleTimeString()}
速度: ${record.speed} 字符/分钟${operationText}`;
                        }
                      }}
                      onMouseLeave={() => {
                        const tooltip = document.getElementById('chart-tooltip');
                        if (tooltip) {
                          tooltip.style.display = 'none';
                        }
                      }}
                    />
                  );
                } else if (shape === "triangle") {
                  // 三角形
                  const size = pointSize * 1.5;
                  return (
                    <polygon
                      key={index}
                      points={`${x},${y-size} ${x+size},${y+size} ${x-size},${y+size}`}
                      fill={pointColor}
                      onMouseEnter={() => {
                        const tooltip = document.getElementById('chart-tooltip');
                        if (tooltip) {
                          tooltip.style.display = 'block';
                          tooltip.style.left = `${x + 10}px`;
                          tooltip.style.top = `${y - 30}px`;

                          let operationText = '';
                          if (record.action) {
                            operationText = `\n模式: ${record.action.type === 'A' ? '添加' : '反馈'}`;
                            operationText += `\n操作: ${
                              record.action.operation === 'apply' ? '应用' :
                              record.action.operation === 'like' ? '点赞' : '拒绝'
                            }`;
                          }

                          tooltip.textContent = `时间: ${new Date(record.timestamp).toLocaleTimeString()}
速度: ${record.speed} 字符/分钟${operationText}`;
                        }
                      }}
                      onMouseLeave={() => {
                        const tooltip = document.getElementById('chart-tooltip');
                        if (tooltip) {
                          tooltip.style.display = 'none';
                        }
                      }}
                    />
                  );
                } else if (shape === "square") {
                  // 方形
                  const size = pointSize * 1.2;
                  return (
                    <rect
                      key={index}
                      x={x - size/2}
                      y={y - size/2}
                      width={size}
                      height={size}
                      fill={pointColor}
                      onMouseEnter={() => {
                        const tooltip = document.getElementById('chart-tooltip');
                        if (tooltip) {
                          tooltip.style.display = 'block';
                          tooltip.style.left = `${x + 10}px`;
                          tooltip.style.top = `${y - 30}px`;

                          let operationText = '';
                          if (record.action) {
                            operationText = `\n模式: ${record.action.type === 'A' ? '添加' : '反馈'}`;
                            operationText += `\n操作: ${
                              record.action.operation === 'apply' ? '应用' :
                              record.action.operation === 'like' ? '点赞' : '拒绝'
                            }`;
                          }

                          tooltip.textContent = `时间: ${new Date(record.timestamp).toLocaleTimeString()}
速度: ${record.speed} 字符/分钟${operationText}`;
                        }
                      }}
                      onMouseLeave={() => {
                        const tooltip = document.getElementById('chart-tooltip');
                        if (tooltip) {
                          tooltip.style.display = 'none';
                        }
                      }}
                    />
                  );
                }
              }
              return null;
            })}
          </svg>

          {/* Tooltip */}
          <div
            id="chart-tooltip"
            className="absolute hidden bg-black text-white p-2 rounded text-xs whitespace-pre z-10"
            style={{ pointerEvents: 'none' }}
          />
        </div>
        <div className="mt-2 text-xs text-gray-500 text-center">
          总记录数: {records.length} | 图表点数: {sampledRecords.length} | 最大速度: {maxSpeed} 字符/分钟
        </div>
      </div>
    );
  };

  // 导出打字速度记录为CSV
  const exportSpeedRecordsToCSV = () => {
    if (typingSpeedRecords.length === 0) {
      alert('没有可导出的打字速度记录');
      return;
    }

    // 创建CSV内容，添加用户操作的标记
    const csvHeader = 'timestamp,speed,action_type,suggestion_id,operation\n';
    const csvRows = typingSpeedRecords.map(record => {
      let actionType = '';
      let suggestionId = '';
      let operation = '';

      if (record.action) {
        // 使用统一的模式标记
        actionType = record.action.type; // A 或 F

        if (record.action.suggestionId) {
          suggestionId = record.action.suggestionId.toString();
        }

        operation = record.action.operation; // apply, like, reject
      }

      return `${record.timestamp},${record.speed},${actionType},${suggestionId},${operation}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // 创建Blob并生成下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `typing-speed-${sessionId}-${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 导出写作位置记录为CSV
  const exportPositionRecordsToCSV = () => {
    if (writingPositionRecords.length === 0) {
      alert('没有可导出的写作位置记录');
      return;
    }

    // 创建CSV内容
    const csvHeader = 'timestamp,text_length,word_count,last_sentence\n';
    const csvRows = writingPositionRecords.map(record => {
      // 处理可能包含逗号的最后一句话
      const cleanLastSentence = record.lastSentence.replace(/"/g, '""'); // CSV转义
      return `${record.timestamp},${record.textLength},${record.wordCount},"${cleanLastSentence}"`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // 创建Blob并生成下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `writing-position-${sessionId}-${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    setTypingSpeedRecords([]);
    setTypingHistory([]);
    setTypingSpeed(0);
    setActiveHighlight(null);
    setWritingPositionRecords([]); // 清除写作位置记录

    // 清除本地存储
    localStorage.removeItem("user");

    // 清理计时器
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    if (typingRecordTimerRef.current) {
      clearInterval(typingRecordTimerRef.current);
    }
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
              <span className="text-sm font-bold">{typingSpeed}</span>
              <span className="text-sm ml-1">字符/分钟</span>
            </div>
            <button
              onClick={exportSpeedRecordsToCSV}
              className="bg-blue-800 hover:bg-blue-900 text-white text-sm py-1 px-3 rounded transition-colors"
            >
              导出速度CSV
            </button>
            <button
              onClick={exportPositionRecordsToCSV}
              className="bg-green-600 hover:bg-green-700 text-white text-sm py-1 px-3 rounded transition-colors"
            >
              导出位置CSV
            </button>
            <button
              onClick={() => setShowTypingChart(!showTypingChart)}
              className="bg-blue-800 hover:bg-blue-900 text-white text-sm py-1 px-3 rounded transition-colors"
            >
              {showTypingChart ? '隐藏图表' : '显示图表'}
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white text-sm py-1 px-3 rounded transition-colors"
            >
              切换/新用户
            </button>
          </div>
        </div>
      </header>

      {showTypingChart && renderTypingSpeedChart()}

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
        Session ID: {sessionId} | 速度记录: {typingSpeedRecords.length} | 位置记录: {writingPositionRecords.length} | 当前速度: {typingSpeed} 字符/分钟
      </footer>
    </div>
  );

  return isRegistered ? renderEditor() : renderLoginForm();
}
