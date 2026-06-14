/** Formatea temperatura en grados Celsius. */
export function formatearTemperatura(celsius: number): string {
  return `${celsius.toFixed(1)}°C`;
}

/** Formatea altitud en metros con separador de miles. */
export function formatearAltitud(metros: number): string {
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
export function formatearHumedad(porcentaje: number): string {
  return `${porcentaje.toFixed(1)}%`;
}
