import { createFileRoute } from "@tanstack/react-router";
import { InjuryRiskPage } from "@/pages/InjuryRiskPage";
import { UI_LABELS } from "@/shared/constants/uiLabels";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: UI_LABELS.app.pageTitle },
      {
        name: "description",
        content: UI_LABELS.app.pageDescription,
      },
    ],
  }),
  component: InjuryRiskPage,
});
