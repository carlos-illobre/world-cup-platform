import { describe, expect, it } from "vitest";
import { getAiInferenceDisplayLabel } from "@/constants/ai-inference";

describe("ai-inference", () => {
  it("genera etiqueta combinada en castellano para cada clase", () => {
    expect(getAiInferenceDisplayLabel(0)).toBe("ESTADO SEGURO / APTO PARA JUGAR");
    expect(getAiInferenceDisplayLabel(1)).toBe(
      "ESTADO DE PRECAUCIÓN / MONITOREAR DE CERCA",
    );
    expect(getAiInferenceDisplayLabel(2)).toBe(
      "ESTADO DE RIESGO / LIMITAR MINUTOS",
    );
  });
});
