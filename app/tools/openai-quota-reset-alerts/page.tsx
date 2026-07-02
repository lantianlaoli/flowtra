import { redirect } from "next/navigation";

export default function OpenAiQuotaResetAlertsRedirectPage() {
  redirect("/tools/codex-quota-reset-alerts");
}
