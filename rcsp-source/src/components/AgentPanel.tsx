import { useEffect, useRef, useState, type FormEvent } from "react";
import { modelHistory, requestModel } from "../agent/client";
import type { Screening } from "../engine/types";
import { useI18n } from "../i18n/LanguageProvider";
import { updateScreening } from "../services/screening";
import { ModelThread } from "./ModelThread";

export function AgentPanel({
  screening,
  onChange,
}: {
  screening: Screening;
  onChange: (next: Screening) => void;
}) {
  const { lang, t } = useI18n();
  const latest = useRef(screening);
  latest.current = screening;
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const turns = screening.modelTurns ?? [];

  useEffect(() => {
    const last = screening.modelTurns?.[screening.modelTurns.length - 1];
    if (!last) return;
    if (last.tools.length) console.info("rcsp-model-tools", last.tools.join(","));
    if (last.errorCode) console.info("rcsp-model-error", last.errorCode, last.errorStatus ?? "");
  }, [screening.modelTurns]);

  async function ask(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || pending) return;
    setQuestion("");
    setPending(true);
    const turn = await requestModel({
      message: trimmed,
      language: lang,
      history: modelHistory(latest.current.modelTurns),
      screenedQuery: latest.current.facts.query,
    });
    const current = latest.current;
    onChange(
      updateScreening(current, {
        goal: current.goal || trimmed,
        modelTurns: [...(current.modelTurns ?? []), turn],
      }),
    );
    setPending(false);
  }

  return (
    <section className="panel ask-panel" aria-labelledby="agent-heading">
      <h2 id="agent-heading">{t("agent.askTitle")}</h2>
      <form onSubmit={ask}>
        <label htmlFor="follow-up">{t("agent.goalLabel")}</label>
        <textarea id="follow-up" value={question} placeholder={t("agent.followPlaceholder")} onChange={(event) => setQuestion(event.target.value)} rows={3} disabled={pending} />
        <button className="btn" type="submit" disabled={pending}>
          {pending ? t("agent.asking") : t("agent.askButton")}
        </button>
      </form>
      <ModelThread turns={turns} />
    </section>
  );
}
