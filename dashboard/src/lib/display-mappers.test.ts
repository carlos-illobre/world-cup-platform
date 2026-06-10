import { describe, expect, it } from "vitest";
import { translateRatingLabel, translateStressLevel } from "@/lib/display-mappers";

describe("display-mappers", () => {
  it("traduce etiquetas de calificación al castellano", () => {
    expect(translateRatingLabel("EXCELLENT")).toBe("EXCELENTE");
    expect(translateRatingLabel("GOOD")).toBe("BUENO");
    expect(translateRatingLabel("FAIR")).toBe("REGULAR");
  });

  it("devuelve la etiqueta original si no hay traducción", () => {
    expect(translateRatingLabel("UNKNOWN")).toBe("UNKNOWN");
  });

  it("traduce niveles de estrés al castellano", () => {
    expect(translateStressLevel("LOW")).toBe("BAJO");
    expect(translateStressLevel("MODERATE")).toBe("MODERADO");
    expect(translateStressLevel("HIGH")).toBe("ALTO");
  });
});
