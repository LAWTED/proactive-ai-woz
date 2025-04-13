"use client";

import React, { useState, useRef } from 'react';

interface SpeedRecord {
  timestamp: string;
  speed: number;
  action_type: string;
  suggestion_id: string;
}

export default function ImportCSVPage() {
  const [records, setRecords] = useState<SpeedRecord[]>([]);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',');

        // 验证CSV格式
        if (!headers.includes('timestamp') || !headers.includes('speed')) {
          throw new Error('CSV文件格式不正确，需要包含timestamp和speed列');
        }

        const parsedRecords: SpeedRecord[] = lines
          .slice(1) // 跳过表头
          .filter(line => line.trim()) // 过滤空行
          .map(line => {
            const [timestamp, speed, action_type = '', suggestion_id = ''] = line.split(',');
            return {
              timestamp,
              speed: parseInt(speed, 10),
              action_type,
              suggestion_id
            };
          });

        setRecords(parsedRecords);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : '解析CSV文件时出错');
        setRecords([]);
      }
    };
    reader.readAsText(file);
  };

  const renderChart = () => {
    if (records.length === 0) return null;

    // 处理可能的数据量过大问题
    let sampledRecords = records;
    if (records.length > 120) {
      const sampleRate = Math.ceil(records.length / 120);
      sampledRecords = records.filter((_, index) => index % sampleRate === 0);

      // 确保包含带有action的记录
      const actionRecords = records.filter(r => r.action_type);
      sampledRecords = [...sampledRecords, ...actionRecords].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }

    const chartHeight = 400;
    const chartWidth = Math.min(1200, window.innerWidth - 100);
    const maxSpeed = Math.max(...sampledRecords.map(r => r.speed), 10);

    // 生成图表点
    const points = sampledRecords.map((record, index) => {
      const x = (index / (sampledRecords.length - 1 || 1)) * chartWidth;
      const y = chartHeight - (record.speed / (maxSpeed || 1)) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    // 计算时间标签
    const timeLabels = [];
    if (sampledRecords.length > 1) {
      // 添加更多的时间标签点（5个）
      for (let i = 0; i < 5; i++) {
        const index = Math.floor((sampledRecords.length - 1) * (i / 4));
        const time = new Date(sampledRecords[index].timestamp);
        timeLabels.push({
          x: (index / (sampledRecords.length - 1)) * chartWidth,
          label: time.toLocaleString()
        });
      }
    }

    // 图例
    const legends = [
      { color: "#3b82f6", label: "打字速度" },
      { color: "#8b5cf6", label: "添加模式 (A)" },
      { color: "#f59e0b", label: "反馈模式 (F)" }
    ];

    // 计算统计信息
    const stats = {
      totalPoints: records.length,
      avgSpeed: Math.round(records.reduce((sum, r) => sum + r.speed, 0) / records.length),
      maxSpeed: Math.max(...records.map(r => r.speed)),
      addCount: records.filter(r => r.action_type === 'A').length,
      feedbackCount: records.filter(r => r.action_type === 'F').length,
      duration: Math.round((new Date(records[records.length - 1].timestamp).getTime() -
                          new Date(records[0].timestamp).getTime()) / 1000 / 60) // 分钟
    };

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        {/* 统计信息 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800">基本信息</h3>
            <p className="text-sm text-blue-600">总数据点: {stats.totalPoints}</p>
            <p className="text-sm text-blue-600">记录时长: {stats.duration} 分钟</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-yellow-800">速度统计</h3>
            <p className="text-sm text-yellow-600">平均速度: {stats.avgSpeed} 字符/分钟</p>
            <p className="text-sm text-yellow-600">最高速度: {stats.maxSpeed} 字符/分钟</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-800">操作统计</h3>
            <p className="text-sm text-purple-600">添加模式: {stats.addCount} 次</p>
            <p className="text-sm text-purple-600">反馈模式: {stats.feedbackCount} 次</p>
          </div>
        </div>

        {/* 图例 */}
        <div className="flex space-x-4 mb-4">
          {legends.map((legend, index) => (
            <div key={index} className="flex items-center">
              <div
                className="w-3 h-3 rounded-full mr-1"
                style={{ backgroundColor: legend.color }}
              ></div>
              <span className="text-xs text-gray-600">{legend.label}</span>
            </div>
          ))}
        </div>

        {/* 图表 */}
        <div className="relative" style={{ height: `${chartHeight + 40}px`, width: '100%' }}>
          <svg width="100%" height={chartHeight + 40} className="overflow-visible">
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
                  fontSize="12"
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
                y={chartHeight + 20}
                fontSize="12"
                fill="#6b7280"
                textAnchor="middle"
                transform={`rotate(45, ${item.x}, ${chartHeight + 20})`}
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

            {/* 数据点 */}
            {sampledRecords.map((record, index) => {
              const x = (index / (sampledRecords.length - 1 || 1)) * chartWidth;
              const y = chartHeight - (record.speed / (maxSpeed || 1)) * chartHeight;

              let pointColor = "#3b82f6"; // 默认蓝色
              let pointSize = 3;

              if (record.action_type) {
                pointSize = 6;
                if (record.action_type === 'F') {
                  pointColor = "#f59e0b"; // 反馈模式黄色
                } else if (record.action_type === 'A') {
                  pointColor = "#8b5cf6"; // 添加模式紫色
                }
              }

              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r={pointSize}
                  fill={pointColor}
                  className="transition-all duration-200 hover:r-8"
                  onMouseEnter={(e) => {
                    const circle = e.target as SVGCircleElement;
                    circle.setAttribute('r', '8');

                    // 显示tooltip
                    const tooltip = document.getElementById('tooltip');
                    if (tooltip) {
                      tooltip.style.display = 'block';
                      tooltip.style.left = `${x + 10}px`;
                      tooltip.style.top = `${y - 30}px`;
                      tooltip.textContent = `时间: ${new Date(record.timestamp).toLocaleString()}
速度: ${record.speed}
操作: ${record.action_type || '无'}`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    const circle = e.target as SVGCircleElement;
                    circle.setAttribute('r', pointSize.toString());

                    // 隐藏tooltip
                    const tooltip = document.getElementById('tooltip');
                    if (tooltip) {
                      tooltip.style.display = 'none';
                    }
                  }}
                />
              );
            })}
          </svg>

          {/* Tooltip */}
          <div
            id="tooltip"
            className="absolute hidden bg-black text-white p-2 rounded text-xs whitespace-pre"
            style={{ pointerEvents: 'none' }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">打字速度数据分析</h1>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
            >
              选择CSV文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            {records.length > 0 && (
              <span className="text-green-600">
                已加载 {records.length} 条记录
              </span>
            )}
          </div>

          {error && (
            <div className="mt-4 text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}
        </div>

        {records.length > 0 && renderChart()}
      </div>
    </div>
  );
}