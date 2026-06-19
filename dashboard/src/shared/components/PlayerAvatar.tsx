import { useState, useEffect } from "react";
import { UserRound } from "lucide-react";

interface PlayerAvatarProps {
  faceUrl: string;
  playerName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PlayerAvatarProps["size"]>, string> = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-14 w-14",
};

/**
 * Avatar circular del jugador — componente DRY para evitar repetición
 * de la imagen de perfil con sus clases de estilo en múltiples componentes.
 */
export function PlayerAvatar({ faceUrl, playerName, size = "md", className }: PlayerAvatarProps) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [faceUrl]);

  if (!faceUrl || error) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-full bg-secondary/80 ring-1 ring-border ${SIZE_CLASSES[size]} ${className ?? ""}`}>
        <UserRound className="h-1/2 w-1/2 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={faceUrl}
      alt={playerName}
      onError={() => setError(true)}
      className={`shrink-0 rounded-full object-cover ring-1 ring-border ${SIZE_CLASSES[size]} ${className ?? ""}`}
    />
  );
}
