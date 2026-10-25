import type { ModelTurn } from "../engine/types";
import { useI18n } from "../i18n/LanguageProvider";
import type { MessageKey } from "../i18n/messages";
import { Markdown } from "./Markdown";

const errorKeys: Record<NonNullable<ModelTurn["errorCode"]>, MessageKey> = {
  missing_key: "agent.missingKey",
  model_failed: "agent.modelFailed",
  bad_response: "agent.badResponse",
  unavailable: "agent.unavailable",
};

export function ModelThread({ turns }: { turns: ModelTurn[] }) {
  const { t } = useI18n();
  if (!turns.length) return null;
  return (
    <div className="thread">
      {turns.map((turn, index) => (
        <article key={`${index}-${turn.question}`} className="follow-up">
          <h3>{turn.question}</h3>
          {turn.errorCode ? (
            <p className="notice notice-stop" role="status">
              {t(errorKeys[turn.errorCode], { status: turn.errorStatus ?? "—" })}
            </p>
          ) : (
            turn.answer && <Markdown text={turn.answer} />
          )}
        </article>
      ))}
    </div>
  );
}
