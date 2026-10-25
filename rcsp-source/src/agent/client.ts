import type { ModelTurn } from "../engine/types";
import type { Lang } from "../i18n/messages";

export async function requestModel(input: {
  message: string;
  language: Lang;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  screenedQuery: string;
}): Promise<ModelTurn> {
  const question = input.message.trim();
  try {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: question,
        language: input.language,
        history: input.history,
        screenedQuery: input.screenedQuery,
      }),
    });
    const payload = (await response.json()) as { answer?: string; tools?: string[]; error?: ModelTurn["errorCode"]; status?: number | null };
    const tools = Array.isArray(payload.tools) ? payload.tools.filter((item) => typeof item === "string") : [];
    if (response.ok && payload.answer?.trim()) {
      return { question, answer: payload.answer.trim(), tools };
    }
    const errorCode = payload.error ?? "model_failed";
    return { question, tools, errorCode, errorStatus: payload.status ?? response.status };
  } catch {
    return { question, tools: [], errorCode: "unavailable" };
  }
}

export function modelHistory(turns: ModelTurn[] | undefined): Array<{ role: "user" | "assistant"; content: string }> {
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const turn of turns ?? []) {
    if (!turn.answer) continue;
    history.push({ role: "user", content: turn.question });
    history.push({ role: "assistant", content: turn.answer });
  }
  return history;
}
