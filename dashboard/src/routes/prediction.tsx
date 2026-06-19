import { createFileRoute } from "@tanstack/react-router";
import { MatchPredictionPage } from "@/pages/MatchPredictionPage";
import { UI_LABELS } from "@/shared/constants/uiLabels";

export const Route = createFileRoute("/prediction")({
  head: () => ({
    meta: [
      { title: `Predicción - ${UI_LABELS.app.pageTitle}` },
    ],
  }),
  component: MatchPredictionPage,
});
