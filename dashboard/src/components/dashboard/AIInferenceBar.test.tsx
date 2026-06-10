import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { AIInferenceBar } from "@/components/dashboard/AIInferenceBar";
import { renderWithProviders } from "@/test/test-utils";

describe("AIInferenceBar", () => {
  it("muestra la inferencia IA traducida al castellano", () => {
    renderWithProviders(
      <AIInferenceBar
        inference={{
          class: 0,
          label: "STATUS SAFE / FIT TO PLAY",
          justification: "Texto de justificación de prueba.",
        }}
      />,
    );

    expect(
      screen.getByText(/INFERENCIA IA: ESTADO SEGURO \/ APTO PARA JUGAR/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Justificación técnica de la IA:/i)).toBeInTheDocument();
    expect(screen.getByText(/Texto de justificación de prueba/i)).toBeInTheDocument();
  });
});
