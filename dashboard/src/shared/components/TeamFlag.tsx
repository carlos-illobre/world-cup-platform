interface TeamFlagProps {
  flagUrl: string;
  teamName: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<TeamFlagProps["size"]>, string> = {
  xs: "h-[13px] w-[18px]",
  sm: "h-[14px] w-5",
  md: "h-7 w-10",
};

/**
 * Bandera del equipo nacional — componente DRY para evitar repetición
 * de la imagen de bandera con sus clases de estilo en múltiples componentes.
 */
export function TeamFlag({ flagUrl, teamName, size = "md", className }: TeamFlagProps) {
  return (
    <img
      src={flagUrl}
      alt={teamName}
      className={`rounded-sm object-cover ring-1 ring-border ${SIZE_CLASSES[size]} ${className ?? ""}`}
    />
  );
}
