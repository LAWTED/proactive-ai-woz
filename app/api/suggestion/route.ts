import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { SystemPrompts } from "@/lib/SystemPrompts";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // 获取用户原文的最后一个句子, 可以从 , 或者。 或者 等符号开始
    const lastSentence = prompt.split(/[.,。 ，]|\s/).pop();

    console.log(lastSentence);
    const response = await openai.chat.completions.create({
      model: "deepseek-v3",
      messages: [
        {
          role: "system",
          content: SystemPrompts.suggestion,
        },
        {
          role: "user",
          content: `用户原文: ${prompt}, 请接着用户原文的最后一个句子${lastSentence} 继续补全, 不要重复${lastSentence}。`,
        },
      ],
    });

    console.log(response.choices[0].message.content);
    return NextResponse.json({
      suggestion: response.choices[0].message.content,
      originalContext: lastSentence,
    });
  } catch (error) {
    console.error("Suggestion API error:", error);
    return NextResponse.json(
      { error: "Failed to get suggestion" },
      { status: 500 }
    );
  }
}
