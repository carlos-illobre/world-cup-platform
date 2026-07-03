interface Step {
  label: string;
  colorClass: string; // e.g. "bg-blue-500/20 text-blue-300"
}

interface PipelineHeaderProps {
  title: string;
  description: string;
  steps: Step[];
  /** Optional emoji or icon for the pipeline label */
  pipelineLabel?: string;
}

/**
 * Standardized header for all Data Science view panels.
 * Shows title, description, and a visual pipeline flow diagram.
 */
export function PipelineHeader({
  title,
  description,
  steps,
  pipelineLabel = "Pipeline de procesamiento:",
}: PipelineHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-neon-blue/5 to-purple-500/5 border border-white/10 rounded-xl p-6">
      <h2 className="text-2xl font-display font-bold text-white mb-3">
        {title}
      </h2>
      <p className="text-base text-gray-300 leading-relaxed mb-4">
        {description}
      </p>
      <div className="bg-black/40 rounded-lg p-4 border border-white/5">
        <p className="text-sm text-gray-400 font-semibold mb-3">
          📐 {pipelineLabel}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {steps.map((step, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className={`${step.colorClass} px-3 py-1 rounded-lg font-medium`}>
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <span className="text-gray-600 font-bold">→</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
