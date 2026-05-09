import { generateText } from "ai";
import { nanogpt } from "@/lib/nanogpt";

const TITLE_MODEL = process.env.TITLE_MODEL ?? "deepseek/deepseek-v4-flash";

export async function generateTitle(
  userText: string,
  assistantText: string,
): Promise<string> {
  const provider = nanogpt();
  const { text } = await generateText({
    model: provider(TITLE_MODEL),
    system:
      "You generate short, descriptive chat titles. Reply with 2–6 words, no quotes, no trailing punctuation, no emojis, no prefix like 'Title:'.",
    prompt: `User: ${userText.slice(0, 600)}\n\nAssistant: ${assistantText.slice(0, 600)}\n\nTitle:`,
    maxTokens: 24,
    temperature: 0.4,
  });
  return (
    text
      .trim()
      .replace(/^["'`]+|["'`.!?]+$/g, "")
      .replace(/^title:\s*/i, "")
      .slice(0, 80) || "New chat"
  );
}
