import { createFileRoute } from "@tanstack/react-router";
import { TeamComparePage } from "@/pages/TeamComparePage";
import { UI_LABELS } from "@/shared/constants/uiLabels";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: `Comparador - ${UI_LABELS.app.pageTitle}` },
    ],
  }),
  component: TeamComparePage,
});
