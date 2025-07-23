"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import JSZip from 'jszip';

interface User {
  id: number;
  name: string;
  session_id: string;
  created_at: string;
}

interface Document {
  id: number;
  content: string;
  user_id: number;
  created_at: string;
  updated_at: string;
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

interface UserData {
  user: User;
  documents: Document[];
  suggestions: Suggestion[];
  documentCount: number;
  suggestionCount: number;
  acceptedSuggestions: number;
  rejectedSuggestions: number;
}

export default function AdminPage() {
  const [userData, setUserData] = useState<UserData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState<boolean>(false);

  useEffect(() => {
    fetchAllUserData();
  }, []);

  const fetchAllUserData = async () => {
    try {
      setLoading(true);

      // 获取所有用户
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      if (!users) return;

      // 为每个用户获取相关数据
      const userDataPromises = users.map(async (user: User) => {
        // 获取用户文档
        const { data: documents, error: docsError } = await supabase
          .from('documents')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (docsError) {
          console.error(`Error fetching docs for user ${user.id}:`, docsError);
        }

        // 获取用户建议
        const { data: suggestions, error: suggestionsError } = await supabase
          .from('suggestions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (suggestionsError) {
          console.error(`Error fetching suggestions for user ${user.id}:`, suggestionsError);
        }

        const userSuggestions = suggestions || [];
        const acceptedSuggestions = userSuggestions.filter(s => s.is_accepted === true).length;
        const rejectedSuggestions = userSuggestions.filter(s => s.is_accepted === false).length;

        return {
          user,
          documents: documents || [],
          suggestions: userSuggestions,
          documentCount: documents?.length || 0,
          suggestionCount: userSuggestions.length,
          acceptedSuggestions,
          rejectedSuggestions,
        };
      });

      const allUserData = await Promise.all(userDataPromises);
      setUserData(allUserData);
    } catch (error) {
      console.error('Error fetching user data:', error);
      alert('获取用户数据失败');
    } finally {
      setLoading(false);
    }
  };

  const generateUserCSVContent = (user: UserData) => {
    const csvData = [];
    
    // 计算统计信息
    const acceptanceRate = user.suggestionCount > 0 ? 
      ((user.acceptedSuggestions / user.suggestionCount) * 100).toFixed(2) : '0.00';
    
    // CSV头部 - 详细版本
    csvData.push([
      'user_id', 'user_name', 'session_id', 'user_created_at',
      'document_id', 'document_content_length', 'document_content', 'document_created_at', 'document_updated_at', 'document_edit_duration_minutes',
      'suggestion_id', 'suggestion_type', 'suggestion_content_length', 'suggestion_content', 'suggestion_is_accepted', 
      'suggestion_reaction', 'suggestion_created_at', 'wizard_session_id', 'suggestion_position', 'suggestion_end_position', 'selected_text',
      'user_suggestion_count', 'user_acceptance_rate', 'user_document_count'
    ]);

    // 如果用户有文档和建议，创建组合行
    if (user.documents.length > 0 && user.suggestions.length > 0) {
      user.documents.forEach(doc => {
        // 计算文档编辑时长（分钟）
        const editDuration = doc.updated_at && doc.created_at ? 
          Math.round((new Date(doc.updated_at).getTime() - new Date(doc.created_at).getTime()) / (1000 * 60)) : 0;
        
        user.suggestions.forEach(suggestion => {
          csvData.push([
            user.user.id,
            user.user.name,
            user.user.session_id,
            user.user.created_at,
            doc.id,
            doc.content?.length || 0,
            doc.content || '',
            doc.created_at,
            doc.updated_at,
            editDuration,
            suggestion.id,
            suggestion.type,
            suggestion.content?.length || 0,
            suggestion.content || '',
            suggestion.is_accepted,
            suggestion.reaction || '',
            suggestion.created_at,
            suggestion.wizard_session_id || '',
            suggestion.position || '',
            suggestion.end_position || '',
            suggestion.selected_text || '',
            user.suggestionCount,
            acceptanceRate + '%',
            user.documentCount
          ]);
        });
      });
    } else if (user.documents.length > 0) {
      // 只有文档，没有建议
      user.documents.forEach(doc => {
        const editDuration = doc.updated_at && doc.created_at ? 
          Math.round((new Date(doc.updated_at).getTime() - new Date(doc.created_at).getTime()) / (1000 * 60)) : 0;
        
        csvData.push([
          user.user.id,
          user.user.name,
          user.user.session_id,
          user.user.created_at,
          doc.id,
          doc.content?.length || 0,
          doc.content || '',
          doc.created_at,
          doc.updated_at,
          editDuration,
          '', '', '', '', '', '', '', '', '', '', '',
          user.suggestionCount,
          acceptanceRate + '%',
          user.documentCount
        ]);
      });
    } else if (user.suggestions.length > 0) {
      // 只有建议，没有文档
      user.suggestions.forEach(suggestion => {
        csvData.push([
          user.user.id,
          user.user.name,
          user.user.session_id,
          user.user.created_at,
          '', '', '', '', '', '',
          suggestion.id,
          suggestion.type,
          suggestion.content?.length || 0,
          suggestion.content || '',
          suggestion.is_accepted,
          suggestion.reaction || '',
          suggestion.created_at,
          suggestion.wizard_session_id || '',
          suggestion.position || '',
          suggestion.end_position || '',
          suggestion.selected_text || '',
          user.suggestionCount,
          acceptanceRate + '%',
          user.documentCount
        ]);
      });
    } else {
      // 用户没有文档和建议
      csvData.push([
        user.user.id,
        user.user.name,
        user.user.session_id,
        user.user.created_at,
        '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
        user.suggestionCount,
        acceptanceRate + '%',
        user.documentCount
      ]);
    }

    // 转换为CSV格式，处理特殊字符
    const csvContent = csvData.map(row => 
      row.map(field => {
        const str = String(field).replace(/"/g, '""').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
        return `"${str}"`;
      }).join(',')
    ).join('\n');

    // 添加BOM以支持中文
    const BOM = '\uFEFF';
    return BOM + csvContent;
  };

  const exportUserDataToCSV = (user: UserData) => {
    const csvContent = generateUserCSVContent(user);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `user-${user.user.name}-详细数据-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAllUsersDataToCSV = () => {
    if (userData.length === 0) {
      alert('没有可导出的数据');
      return;
    }

    const csvData = [];
    
    // CSV头部 - 更详细的摘要
    csvData.push([
      'user_id', 'user_name', 'session_id', 'user_created_at',
      'document_count', 'suggestion_count', 'accepted_suggestions', 'rejected_suggestions', 'pending_suggestions',
      'acceptance_rate', 'rejection_rate', 'append_suggestions', 'comment_suggestions',
      'total_document_length', 'average_document_length', 'latest_document_content_length', 'latest_document_updated_at',
      'first_suggestion_date', 'last_suggestion_date', 'activity_span_days', 'suggestions_with_reaction',
      'liked_suggestions', 'applied_suggestions'
    ]);

    // 添加每个用户的详细摘要数据
    userData.forEach(user => {
      const latestDoc = user.documents[0]; // 已按updated_at排序
      const totalDocLength = user.documents.reduce((sum, doc) => sum + (doc.content?.length || 0), 0);
      const avgDocLength = user.documentCount > 0 ? Math.round(totalDocLength / user.documentCount) : 0;
      
      const acceptanceRate = user.suggestionCount > 0 ? 
        ((user.acceptedSuggestions / user.suggestionCount) * 100).toFixed(2) : '0.00';
      const rejectionRate = user.suggestionCount > 0 ? 
        ((user.rejectedSuggestions / user.suggestionCount) * 100).toFixed(2) : '0.00';
      
      const pendingSuggestions = user.suggestionCount - user.acceptedSuggestions - user.rejectedSuggestions;
      const appendSuggestions = user.suggestions.filter(s => s.type === 'append').length;
      const commentSuggestions = user.suggestions.filter(s => s.type === 'comment').length;
      
      const suggestionsWithReaction = user.suggestions.filter(s => s.reaction).length;
      const likedSuggestions = user.suggestions.filter(s => s.reaction === 'like').length;
      const appliedSuggestions = user.suggestions.filter(s => s.reaction === 'apply').length;
      
      const suggestionDates = user.suggestions.map(s => new Date(s.created_at)).sort((a, b) => a.getTime() - b.getTime());
      const firstSuggestionDate = suggestionDates.length > 0 ? suggestionDates[0].toISOString().split('T')[0] : '';
      const lastSuggestionDate = suggestionDates.length > 0 ? suggestionDates[suggestionDates.length - 1].toISOString().split('T')[0] : '';
      const activitySpanDays = suggestionDates.length > 1 ? 
        Math.ceil((suggestionDates[suggestionDates.length - 1].getTime() - suggestionDates[0].getTime()) / (1000 * 60 * 60 * 24)) : 0;

      csvData.push([
        user.user.id,
        user.user.name,
        user.user.session_id,
        user.user.created_at,
        user.documentCount,
        user.suggestionCount,
        user.acceptedSuggestions,
        user.rejectedSuggestions,
        pendingSuggestions,
        acceptanceRate + '%',
        rejectionRate + '%',
        appendSuggestions,
        commentSuggestions,
        totalDocLength,
        avgDocLength,
        latestDoc?.content?.length || 0,
        latestDoc?.updated_at || '',
        firstSuggestionDate,
        lastSuggestionDate,
        activitySpanDays,
        suggestionsWithReaction,
        likedSuggestions,
        appliedSuggestions
      ]);
    });

    // 转换为CSV格式，处理特殊字符
    const csvContent = csvData.map(row => 
      row.map(field => {
        const str = String(field).replace(/"/g, '""').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
        return `"${str}"`;
      }).join(',')
    ).join('\n');

    // 添加BOM以支持中文
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `所有用户详细摘要-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedUserIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedUserIds(new Set(userData.map(user => user.user.id)));
      setSelectAll(true);
    }
  };

  const handleSelectUser = (userId: number) => {
    const newSelectedIds = new Set(selectedUserIds);
    if (newSelectedIds.has(userId)) {
      newSelectedIds.delete(userId);
    } else {
      newSelectedIds.add(userId);
    }
    setSelectedUserIds(newSelectedIds);
    setSelectAll(newSelectedIds.size === userData.length);
  };

  const exportSelectedUsersDataToZip = async () => {
    if (selectedUserIds.size === 0) {
      alert('请先选择要导出的用户');
      return;
    }

    const selectedUsers = userData.filter(user => selectedUserIds.has(user.user.id));
    const zip = new JSZip();

    // 为每个用户生成CSV文件并添加到ZIP
    selectedUsers.forEach(user => {
      const csvContent = generateUserCSVContent(user);
      const fileName = `${user.user.name}-详细数据-${user.user.id}.csv`;
      zip.file(fileName, csvContent);
    });

    try {
      // 生成ZIP文件
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // 创建下载链接
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `选中用户详细数据-${selectedUserIds.size}人-${new Date().toISOString().split('T')[0]}.zip`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 清理URL对象
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('生成ZIP文件失败:', error);
      alert('导出失败，请重试');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white p-6">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold">用户数据管理系统</h1>
          <p className="mt-2 text-indigo-200">查看和导出所有用户的写作数据</p>
        </div>
      </header>

      <div className="container mx-auto p-6">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="text-lg font-semibold text-gray-700">
              总用户数: {userData.length} | 已选择: {selectedUserIds.size}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={exportSelectedUsersDataToZip}
                disabled={selectedUserIds.size === 0}
                className={`px-4 py-2 rounded-lg font-medium ${
                  selectedUserIds.size === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                导出选中用户ZIP ({selectedUserIds.size})
              </button>
              <button
                onClick={exportAllUsersDataToCSV}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                导出所有用户摘要CSV
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 p-4 bg-gray-100 rounded-lg">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                {selectAll ? '取消全选' : '全选'}
              </span>
            </label>
            <span className="text-sm text-gray-600">
              选择用户进行批量操作
            </span>
          </div>
        </div>

        <div className="grid gap-6">
          {userData.map((user) => (
            <div key={user.user.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-start space-x-3">
                  <label className="flex items-center mt-1">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(user.user.id)}
                      onChange={() => handleSelectUser(user.user.id)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </label>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{user.user.name}</h2>
                    <p className="text-gray-600">用户ID: {user.user.id}</p>
                    <p className="text-gray-600">会话ID: {user.user.session_id}</p>
                    <p className="text-gray-600">注册时间: {formatDate(user.user.created_at)}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedUser(selectedUser?.user.id === user.user.id ? null : user)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  >
                    {selectedUser?.user.id === user.user.id ? '隐藏详情' : '查看详情'}
                  </button>
                  <button
                    onClick={() => exportUserDataToCSV(user)}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                  >
                    导出详细CSV
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-blue-50 p-3 rounded">
                  <div className="text-blue-800 font-semibold">文档数量</div>
                  <div className="text-2xl font-bold text-blue-900">{user.documentCount}</div>
                </div>
                <div className="bg-purple-50 p-3 rounded">
                  <div className="text-purple-800 font-semibold">建议总数</div>
                  <div className="text-2xl font-bold text-purple-900">{user.suggestionCount}</div>
                </div>
                <div className="bg-green-50 p-3 rounded">
                  <div className="text-green-800 font-semibold">已接受</div>
                  <div className="text-2xl font-bold text-green-900">{user.acceptedSuggestions}</div>
                </div>
                <div className="bg-red-50 p-3 rounded">
                  <div className="text-red-800 font-semibold">已拒绝</div>
                  <div className="text-2xl font-bold text-red-900">{user.rejectedSuggestions}</div>
                </div>
              </div>

              {selectedUser?.user.id === user.user.id && (
                <div className="border-t pt-4">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* 文档列表 */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-gray-800">文档 ({user.documents.length})</h3>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {user.documents.map((doc) => (
                          <div key={doc.id} className="bg-gray-50 p-4 rounded border">
                            <div className="flex justify-between items-start mb-2">
                              <div className="text-sm text-gray-600">
                                文档ID: {doc.id} | 长度: {doc.content?.length || 0} 字符
                              </div>
                              <div className="text-xs text-gray-500">
                                编辑时长: {doc.updated_at && doc.created_at ? 
                                  Math.round((new Date(doc.updated_at).getTime() - new Date(doc.created_at).getTime()) / (1000 * 60)) 
                                  : 0} 分钟
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 mb-3">
                              创建: {formatDate(doc.created_at)} | 更新: {formatDate(doc.updated_at)}
                            </div>
                            {doc.content && (
                              <div className="mt-2">
                                <div className="text-xs text-gray-600 mb-1">文档内容:</div>
                                <div className="bg-white p-3 rounded border max-h-32 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap">
                                  {doc.content}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {user.documents.length === 0 && (
                          <div className="text-gray-500 text-center py-4">暂无文档</div>
                        )}
                      </div>
                    </div>

                    {/* 建议列表 */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-gray-800">建议 ({user.suggestions.length})</h3>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {user.suggestions.map((suggestion) => (
                          <div key={suggestion.id} className="bg-gray-50 p-4 rounded border">
                            <div className="flex justify-between items-start mb-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                suggestion.type === 'append' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-purple-100 text-purple-800'
                              }`}>
                                {suggestion.type === 'append' ? '补全' : '建议'}
                              </span>
                              {suggestion.reaction && (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  suggestion.reaction === 'apply' 
                                    ? 'bg-green-100 text-green-800'
                                    : suggestion.reaction === 'like'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {suggestion.reaction === 'apply' ? '已应用' : 
                                   suggestion.reaction === 'like' ? '已点赞' : '已拒绝'}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 mb-1">
                              建议ID: {suggestion.id} | 长度: {suggestion.content?.length || 0} 字符
                            </div>
                            {suggestion.position && (
                              <div className="text-xs text-gray-500 mb-1">
                                位置: {suggestion.position} - {suggestion.end_position || suggestion.position}
                                {suggestion.selected_text && ` | 选中文本: "${suggestion.selected_text}"`}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mb-2">
                              创建时间: {formatDate(suggestion.created_at)}
                              {suggestion.wizard_session_id && ` | 巫师会话: ${suggestion.wizard_session_id}`}
                            </div>
                            {suggestion.content && (
                              <div className="mt-2">
                                <div className="text-xs text-gray-600 mb-1">建议内容:</div>
                                <div className="bg-white p-3 rounded border max-h-24 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap">
                                  {suggestion.content}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {user.suggestions.length === 0 && (
                          <div className="text-gray-500 text-center py-4">暂无建议</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {userData.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-xl mb-2">暂无用户数据</div>
              <div>系统中还没有注册的用户</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}