import { CLUSTER_COLORS, CLUSTER_NAMES } from "../constants";

/**
 * Shared color legend for scatter plots that use cluster-based coloring.
 * Shows a colored dot + cluster name for each tactical profile.
 */
export function ClusterLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 px-1 py-2">
      {Object.entries(CLUSTER_NAMES).map(([id, name]) => (
        <div key={id} className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: CLUSTER_COLORS[id] || "#888" }}
          />
          <span className="text-sm text-gray-200">{name}</span>
        </div>
      ))}
    </div>
  );
}
