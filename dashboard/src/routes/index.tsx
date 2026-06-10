import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { UI_LABELS } from "@/constants/ui-labels";

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
  component: DashboardPage,
});
