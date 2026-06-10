import { AI_INFERENCE_STYLES, getAiInferenceDisplayLabel } from "@/constants/ai-inference";
import { UI_LABELS } from "@/constants/ui-labels";
import type { AiInference } from "@/lib/predictions.types";

interface AIInferenceBarProps {
  inference: AiInference;
}

/** Barra de inferencia IA con estilo según la clase de riesgo. */
export function AIInferenceBar({ inference }: AIInferenceBarProps) {
  const style = AI_INFERENCE_STYLES[inference.class];
  const { Icon } = style;
  const displayLabel = getAiInferenceDisplayLabel(inference.class);

  return (
    <div
      className="glass-panel relative overflow-hidden rounded-2xl px-5 py-4 sm:px-7 sm:py-5"
      style={{
        borderColor: style.accent,
        boxShadow: `${style.glow}, inset 0 0 24px color-mix(in oklab, ${style.accent} 12%, transparent)`,
      }}
    >
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: style.accent, boxShadow: style.glow }}
      />
      <div className="flex items-center justify-center gap-3">
        <Icon
          className="h-6 w-6 shrink-0"
          style={{ color: style.accent, filter: `drop-shadow(${style.glow})` }}
        />
        <h2
          className="font-display text-center text-lg font-extrabold tracking-wide sm:text-2xl"
          style={{ color: style.accent, textShadow: style.glow }}
        >
          {UI_LABELS.aiInference.title(displayLabel, inference.class)}
        </h2>
      </div>
      <p className="mx-auto mt-3 max-w-4xl text-center text-sm leading-relaxed text-foreground/85">
        <span className="font-bold text-foreground">
          {UI_LABELS.aiInference.justificationPrefix}{" "}
        </span>
        {inference.justification}
      </p>
    </div>
  );
}
