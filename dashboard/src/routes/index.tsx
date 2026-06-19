import { createFileRoute } from "@tanstack/react-router";
import { InjuryRiskPage } from "@/pages/InjuryRiskPage";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import { store } from "@/app/store";
import { fixtureApi } from "@/features/fixture/fixtureApi";

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
  loader: () => {
    // Prefetch de los datos iniciales para acelerar el First Contentful Paint.
    // RTK Query se encargará de deducir llamadas duplicadas desde los hooks de React.
    store.dispatch(fixtureApi.endpoints.getFechasJornada.initiate());
  },
  component: InjuryRiskPage,
});
