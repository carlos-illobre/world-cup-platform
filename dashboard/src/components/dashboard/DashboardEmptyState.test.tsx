import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { renderWithProviders } from "@/test/test-utils";

describe("DashboardEmptyState", () => {
  it("muestra los tres pasos pendientes cuando no hay selección", () => {
    renderWithProviders(
      <DashboardEmptyState
        hasDateSelected={false}
        hasMatchSelected={false}
        hasPlayerSelected={false}
      />,
    );

    expect(screen.getByText(/1 · Elegir fecha/i)).toBeInTheDocument();
    expect(screen.getByText(/2 · Elegir partido/i)).toBeInTheDocument();
    expect(screen.getByText(/3 · Elegir jugador/i)).toBeInTheDocument();
  });

  it("indica cuando el partido ya fue seleccionado", () => {
    renderWithProviders(
      <DashboardEmptyState
        hasDateSelected={true}
        hasMatchSelected={true}
        hasPlayerSelected={false}
      />,
    );

    expect(screen.getByText(/✓ Partido seleccionado/i)).toBeInTheDocument();
  });
});
