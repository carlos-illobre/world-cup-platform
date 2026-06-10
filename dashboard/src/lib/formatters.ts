/** Formatea temperatura en grados Celsius. */
export function formatTemperature(celsius: number): string {
  return `${celsius.toFixed(1)}°C`;
}

/** Formatea altitud con separador de miles. */
export function formatAltitude(meters: number): string {
  return `${meters.toLocaleString("es-AR")}m`;
}

/** Formatea porcentaje entero. */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/** Formatea frecuencia cardíaca en latidos por minuto. */
export function formatHeartRate(bpm: number): string {
  return `${bpm} LPM`;
}
