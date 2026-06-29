import { useState } from "react";
import { Info } from "lucide-react";

interface AxisTooltipProps {
  text: string;
}

/**
 * Small info icon that shows an explanatory tooltip on hover.
 * Used next to chart axis labels to explain what the metric means.
 */
export function AxisTooltip({ text }: AxisTooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex items-center ml-1 cursor-help"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <Info className="w-3.5 h-3.5 text-gray-500 hover:text-neon-blue transition-colors" />
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg border border-white/10 bg-black/95 p-2.5 text-xs text-gray-200 shadow-xl backdrop-blur-md z-50 leading-relaxed">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/95" />
        </span>
      )}
    </span>
  );
}
