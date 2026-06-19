/** Formatea temperatura en grados Celsius. */
export function formatearTemperatura(celsius: number | undefined | null): string {
  if (celsius === undefined || celsius === null) return "N/A";
  return `${celsius.toFixed(1)}°C`;
}

/** Formatea altitud en metros con separador de miles. */
export function formatearAltitud(metros: number | undefined | null): string {
  if (metros === undefined || metros === null) return "N/A";
  return `${metros.toLocaleString("es-AR")}m`;
}

/** Formatea un valor como porcentaje entero. */
export function formatearPorcentaje(valor: number): string {
  return `${Math.round(valor)}%`;
}

/** Formatea frecuencia cardíaca en latidos por minuto. */
export function formatearFrecuenciaCardiaca(lpm: number): string {
  return `${lpm} LPM`;
}

/** Formatea humedad como porcentaje con un decimal. */
export function formatearHumedad(porcentaje: number | undefined | null): string {
  if (porcentaje === undefined || porcentaje === null) return "N/A";
  return `${porcentaje.toFixed(1)}%`;
}
