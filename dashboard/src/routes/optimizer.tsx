import { createFileRoute } from "@tanstack/react-router";
import { SquadOptimizerPage } from "@/pages/SquadOptimizerPage";
import { UI_LABELS } from "@/shared/constants/uiLabels";

export const Route = createFileRoute("/optimizer")({
  head: () => ({
    meta: [
      { title: `Optimizador - ${UI_LABELS.app.pageTitle}` },
    ],
  }),
  component: SquadOptimizerPage,
});
