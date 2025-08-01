import { NextResponse } from 'next/server';
import { openai } from "@/lib/openai";
import { SystemPrompts } from "@/lib/SystemPrompts";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // 获取用户原文的最后一个句子或短语
    // 优先按照句号、问号、感叹号分割获取最后一个完整句子
    // 如果没有句子分隔符，则按照逗号、分号等分割获取最后一个短语
    let lastSentence = '';

    // 首先尝试按句子分隔符分割
    const sentences = prompt.split(/[。！？!?]/).filter((s: string) => s.trim());
    if (sentences.length > 0) {
      lastSentence = sentences[sentences.length - 1].trim();
    }

    // 如果没有句子分隔符或最后一个句子为空，按短语分隔符分割
    if (!lastSentence) {
      const phrases = prompt.split(/[，,；;、]/).filter((s: string) => s.trim());
      if (phrases.length > 0) {
        lastSentence = phrases[phrases.length - 1].trim();
      }
    }

    // 如果还是为空，取最后几个词
    if (!lastSentence) {
      const words = prompt.trim().split(/\s+/);
      lastSentence = words.slice(-3).join(' '); // 取最后3个词
    }

    const response = await openai.chat.completions.create({
      model: "deepseek-v3",
      messages: [
        {
          role: "system",
          content: SystemPrompts.comment,
        },
        {
          role: "user",
          content: `用户原文: ${prompt}, 请针对用户原文的最后一个句子${lastSentence} 给出你的建议。`,
        },
      ],
    });

    return NextResponse.json({
      suggestion: response.choices[0].message.content,
      originalContext: lastSentence,
    });
  } catch (error) {
    console.error("Comment suggestion API error:", error);
    return NextResponse.json(
      { error: "Failed to get comment suggestion" },
      { status: 500 }
    );
  }
}