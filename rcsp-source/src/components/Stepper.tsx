import { Link } from "react-router-dom";
import { useI18n } from "../i18n/LanguageProvider";
import type { MessageKey } from "../i18n/messages";

export function Stepper({ id, current, locked }: { id?: string; current: number; locked?: boolean }) {
  const { t } = useI18n();
  const steps: Array<{ label: MessageKey; href?: string }> = [
    { label: "step.address", href: "/" },
    { label: "step.overview", href: id ? `/property/${id}` : "/" },
    { label: "step.assessment", href: id && !locked ? `/property/${id}/assessment` : undefined },
    { label: "step.report", href: id && !locked ? `/property/${id}/report` : undefined },
  ];
  return (
    <ol className="stepper">
      {steps.map((step, index) => {
        const state = index === current ? "is-current" : index < current ? "is-done" : "";
        const body = (
          <>
            <span>{index + 1}</span>
            {t(step.label)}
          </>
        );
        return (
          <li key={step.label} className={state}>
            {step.href && (index <= current || !locked) ? <Link to={step.href}>{body}</Link> : <span className="step-muted">{body}</span>}
          </li>
        );
      })}
    </ol>
  );
}
