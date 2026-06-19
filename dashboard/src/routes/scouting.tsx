import { createFileRoute } from "@tanstack/react-router";
import { ScoutingPage } from "@/pages/ScoutingPage";
import { UI_LABELS } from "@/shared/constants/uiLabels";

export const Route = createFileRoute("/scouting")({
  head: () => ({
    meta: [
      { title: `Scouting - ${UI_LABELS.app.pageTitle}` },
    ],
  }),
  component: ScoutingPage,
});
