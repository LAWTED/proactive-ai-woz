import { NextResponse } from 'next/server';
import { openai } from "@/lib/openai";
import { SystemPrompts } from "@/lib/SystemPrompts";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { content, selectedText } = body;

    if (!content || !selectedText) {
      return NextResponse.json(
        { error: "Content and selectedText are required" },
        { status: 400 }
      );
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
          content: `我在阅读一篇文章，遇到了这段文字，请像普通读者一样给出你的真实、简短的反应：\n\n文档内容: ${content}\n\n选中的文字: "${selectedText}"\n\n像在聊天时那样回应，用口语化的语言，表达你的第一反应（1-2句话）。`,
        },
      ],
    });

    return NextResponse.json({
      suggestion: response.choices[0].message.content,
    });
  } catch (error) {
    console.error("Comment suggestion API error:", error);
    return NextResponse.json(
      { error: "Failed to get comment suggestion" },
      { status: 500 }
    );
  }
}