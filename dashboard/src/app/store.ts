import { configureStore } from "@reduxjs/toolkit";
import { fixtureApi } from "@/features/fixture/fixtureApi";
import { squadApi } from "@/features/squad/squadApi";
import { injuryRiskApi } from "@/features/injury-risk/injuryRiskApi";
import fixtureReducer from "@/features/fixture/fixtureSlice";
import squadReducer from "@/features/squad/squadSlice";

/**
 * Store Redux global de la aplicación.
 * Combina slices de estado de UI + APIs de RTK Query.
 */
export const store = configureStore({
  reducer: {
    fixture: fixtureReducer,
    squad: squadReducer,
    [fixtureApi.reducerPath]: fixtureApi.reducer,
    [squadApi.reducerPath]: squadApi.reducer,
    [injuryRiskApi.reducerPath]: injuryRiskApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(fixtureApi.middleware)
      .concat(squadApi.middleware)
      .concat(injuryRiskApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
