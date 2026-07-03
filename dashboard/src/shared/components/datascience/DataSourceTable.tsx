interface DataSource {
  name: string;
  /** Brief human-readable description */
  description: string;
  /** Filename / URL origin */
  file: string;
  /** Key columns used (comma-separated string for simplicity) */
  columns: string;
  /** Row count — can be passed explicitly or left as "?" if unknown */
  rows?: string | number;
  /** Tailwind border + text color class, e.g. "border-blue-500/20 text-blue-300" */
  colorClass?: string;
}

interface DataSourceTableProps {
  sources: DataSource[];
  title?: string;
}

/**
 * Renders a table/grid of data sources for the Data Science view.
 * Each entry shows: name, description, file origin, row count, and key columns.
 */
export function DataSourceTable({
  sources,
  title = "Fuentes de Datos",
}: DataSourceTableProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-display font-bold text-white flex items-center gap-2">
        🗄️ {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wider">
              <th className="text-left py-2 px-3 bg-white/5 rounded-tl-lg border border-white/10 border-r-0">
                Fuente
              </th>
              <th className="text-left py-2 px-3 bg-white/5 border-y border-white/10">
                Archivo / Origen
              </th>
              <th className="text-center py-2 px-3 bg-white/5 border-y border-white/10">
                Registros
              </th>
              <th className="text-left py-2 px-3 bg-white/5 rounded-tr-lg border border-white/10 border-l-0">
                Columnas Clave
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((src, i) => (
              <tr
                key={i}
                className="hover:bg-white/5 transition-colors group"
              >
                <td className="py-3 px-3 border-b border-white/5 border-r-0 align-top">
                  <div>
                    <span
                      className={`font-bold ${src.colorClass?.split(" ")[1] ?? "text-white"}`}
                    >
                      {src.name}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {src.description}
                    </p>
                  </div>
                </td>
                <td className="py-3 px-3 border-b border-white/5 align-top">
                  <code className="text-xs text-gray-400 font-mono bg-black/30 px-2 py-0.5 rounded">
                    {src.file}
                  </code>
                </td>
                <td className="py-3 px-3 border-b border-white/5 text-center align-top">
                  <span className="text-xs font-mono text-gray-300">
                    {src.rows ?? "—"}
                  </span>
                </td>
                <td className="py-3 px-3 border-b border-white/5 align-top">
                  <p className="text-xs text-gray-400 font-mono leading-relaxed">
                    {src.columns}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
