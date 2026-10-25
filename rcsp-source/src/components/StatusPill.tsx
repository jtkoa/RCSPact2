import type { CheckStatus, RuleState } from "../engine/types";
import { useI18n } from "../i18n/LanguageProvider";
import type { MessageKey } from "../i18n/messages";

const statusKeys: Record<CheckStatus, MessageKey> = {
  PASS: "pill.pass",
  FLAG: "pill.flag",
  NEEDS_VERIFICATION: "pill.verify",
};

const ruleKeys: Record<RuleState, MessageKey> = {
  retrieved: "rule.retrieved",
  unverified: "rule.unverified",
  "not-applied": "rule.notApplied",
};

export function StatusPill({ status }: { status: CheckStatus }) {
  const { t } = useI18n();
  return <span className={`pill pill-${status}`}>{t(statusKeys[status])}</span>;
}

export function RulePill({ rule }: { rule: RuleState }) {
  const { t } = useI18n();
  return <span className={`pill pill-rule pill-${rule}`}>{t(ruleKeys[rule])}</span>;
}
