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

    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: SystemPrompts.suggestion,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return NextResponse.json({
      suggestion: response.choices[0].message.content,
    });
  } catch (error) {
    console.error("Suggestion API error:", error);
    return NextResponse.json(
      { error: "Failed to get suggestion" },
      { status: 500 }
    );
  }
}
