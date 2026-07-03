interface MetricRow {
  label: string;
  valueA: string | number | null | undefined;
  valueB: string | number | null | undefined;
  /** Which model wins this metric: "A" | "B" | "tie" | "lower_is_better" */
  winner?: "A" | "B" | "tie" | "n/a";
  /** Show lower-is-better arrow (e.g. for RMSE, MAE) */
  lowerIsBetter?: boolean;
}

interface MetricsComparisonProps {
  modelAName: string;
  modelBName: string;
  metrics: MetricRow[];
  /** Optional note below the table */
  note?: string;
}

/**
 * Side-by-side metric comparison table for two ML models.
 * Highlights the winner for each metric with color coding.
 */
export function MetricsComparison({
  modelAName,
  modelBName,
  metrics,
  note,
}: MetricsComparisonProps) {
  function cellClass(row: MetricRow, side: "A" | "B"): string {
    if (!row.winner || row.winner === "n/a") return "text-gray-300";
    if (row.winner === "tie") return "text-yellow-300 font-bold";
    if (row.winner === side) return "text-green-400 font-bold";
    return "text-gray-400";
  }

  function format(v: string | number | null | undefined): string {
    if (v == null) return "—";
    if (typeof v === "number") {
      return v < 1 && v > -1 ? v.toFixed(3) : v.toFixed(2);
    }
    return String(v);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 bg-white/5 border border-white/10 border-r-0 rounded-tl-lg text-gray-400 uppercase text-xs tracking-wider font-semibold">
                Métrica
              </th>
              <th className="text-center py-2 px-3 bg-amber-500/10 border-y border-white/10 text-amber-300 font-bold text-xs uppercase tracking-wider">
                {modelAName}
              </th>
              <th className="text-center py-2 px-3 bg-cyan-500/10 border border-white/10 border-l-0 rounded-tr-lg text-cyan-300 font-bold text-xs uppercase tracking-wider">
                {modelBName}
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((row, i) => (
              <tr key={i} className="hover:bg-white/5 transition-colors group">
                <td className="py-2.5 px-3 border-b border-white/5 text-gray-300 font-medium">
                  {row.label}
                  {row.lowerIsBetter && (
                    <span className="ml-1 text-gray-500 text-xs">(↓ mejor)</span>
                  )}
                </td>
                <td className={`py-2.5 px-3 border-b border-white/5 text-center font-mono ${cellClass(row, "A")}`}>
                  {format(row.valueA)}
                  {row.winner === "A" && (
                    <span className="ml-1 text-green-400 text-xs">✓</span>
                  )}
                </td>
                <td className={`py-2.5 px-3 border-b border-white/5 text-center font-mono ${cellClass(row, "B")}`}>
                  {format(row.valueB)}
                  {row.winner === "B" && (
                    <span className="ml-1 text-green-400 text-xs">✓</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && (
        <p className="text-xs text-gray-500 italic border-t border-white/5 pt-2">
          ℹ️ {note}
        </p>
      )}
    </div>
  );
}
