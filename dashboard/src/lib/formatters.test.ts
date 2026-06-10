import { describe, expect, it } from "vitest";
import {
  formatAltitude,
  formatHeartRate,
  formatPercent,
  formatTemperature,
} from "@/lib/formatters";

describe("formatters", () => {
  it("formatea temperatura con un decimal", () => {
    expect(formatTemperature(36.8)).toBe("36.8°C");
  });

  it("formatea altitud con separador de miles", () => {
    expect(formatAltitude(2240)).toMatch(/2\.?240m/);
  });

  it("formatea porcentaje redondeado", () => {
    expect(formatPercent(72.4)).toBe("72%");
  });

  it("formatea frecuencia cardíaca en LPM", () => {
    expect(formatHeartRate(78)).toBe("78 LPM");
  });
});
