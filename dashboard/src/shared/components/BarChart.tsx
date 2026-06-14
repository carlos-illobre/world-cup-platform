interface SerieGrafico {
  label: string;
  values: number[];
  tint: "blue" | "green" | "mixed";
}

interface BarChartProps {
  title: string;
  series: SerieGrafico[];
}

function renderizarBarras(values: number[], tint: SerieGrafico["tint"]) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-16 items-end gap-1">
      {values.map((v, i) => {
        const heightPct = (v / max) * 100;
        const background =
          tint === "blue"
            ? "linear-gradient(180deg, oklch(0.82 0.18 200), oklch(0.55 0.18 232))"
            : tint === "green"
              ? "linear-gradient(180deg, oklch(0.88 0.2 130), oklch(0.6 0.2 150))"
              : i % 2 === 0
                ? "linear-gradient(180deg, oklch(0.88 0.2 130), oklch(0.6 0.2 150))"
                : "linear-gradient(180deg, oklch(0.82 0.18 200), oklch(0.55 0.18 232))";
        return (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all duration-500"
            style={{ height: `${Math.max(8, heightPct)}%`, background }}
          />
        );
      })}
    </div>
  );
}

/** Gráfico de barras para visualizar series de datos de entrenamiento. */
export function BarChart({ title, series }: BarChartProps) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold tracking-wide text-foreground/90">
        {title}
      </h3>
      <div className="flex gap-4">
        {series.map((s) => (
          <div key={s.label} className="flex-1">
            {renderizarBarras(s.values, s.tint)}
            <p className="mt-1.5 text-center text-[0.6rem] font-semibold tracking-[0.2em] text-muted-foreground">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
