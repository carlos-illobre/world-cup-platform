import { createFileRoute } from "@tanstack/react-router";
import { GroupsSimulatorPage } from "@/pages/GroupsSimulatorPage";
import { UI_LABELS } from "@/shared/constants/uiLabels";

export const Route = createFileRoute("/groups")({
  head: () => ({
    meta: [
      { title: `Simulador Grupos - ${UI_LABELS.app.pageTitle}` },
    ],
  }),
  component: GroupsSimulatorPage,
});
