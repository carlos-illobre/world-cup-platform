import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/** Crea el router de TanStack para la aplicación de riesgo de lesiones. */
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
