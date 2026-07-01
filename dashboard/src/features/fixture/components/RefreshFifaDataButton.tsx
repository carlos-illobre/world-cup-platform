import { RefreshCw } from "lucide-react";
import { useAppDispatch } from "@/app/hooks";
import { fixtureApi, useRefreshFifaFixtureMutation } from "@/features/fixture/fixtureApi";
import { resetearFixture } from "@/features/fixture/fixtureSlice";
import { resetearJugadorSeleccionado } from "@/features/squad/squadSlice";
import { squadApi } from "@/features/squad/squadApi";
import { injuryRiskApi } from "@/features/injury-risk/injuryRiskApi";

export function RefreshFifaDataButton() {
  const dispatch = useAppDispatch();
  const [refreshFixture, { isLoading, isSuccess, isError, error, data }] =
    useRefreshFifaFixtureMutation();

  async function handleRefresh() {
    try {
      await refreshFixture().unwrap();
      dispatch(resetearFixture());
      dispatch(resetearJugadorSeleccionado());
      dispatch(fixtureApi.util.invalidateTags(["FechasJornada", "Partidos", "ContextoPartido"]));
      dispatch(squadApi.util.invalidateTags(["Plantilla", "InferenciaPlantilla"]));
      dispatch(injuryRiskApi.util.invalidateTags(["ReportePreparacion"]));
    } catch {
      // RTK Query already exposes the error state for the status text.
    }
  }

  const statusText = isLoading
    ? "Actualizando desde FIFA..."
    : isSuccess
      ? `Actualizado: ${data?.data.matches_updated ?? 0} partidos`
      : isError
        ? `No se pudo actualizar: ${String((error as any)?.data?.detail ?? (error as any)?.error ?? "error desconocido")}`
        : null;

  return (
    <div className="glass-panel flex flex-col gap-2 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0">
        <p className="font-display text-sm font-bold uppercase text-neon-blue">
          Datos oficiales FIFA
        </p>
        {statusText && (
          <p
            className={`mt-1 truncate text-xs ${
              isError ? "text-red-400" : "text-muted-foreground"
            }`}
            title={statusText}
          >
            {statusText}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleRefresh}
        disabled={isLoading}
        className="glass flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border-neon-blue/40 px-4 text-sm font-bold text-neon-blue transition-all hover:border-neon-green/70 hover:text-neon-green disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        Actualizar datos
      </button>
    </div>
  );
}
