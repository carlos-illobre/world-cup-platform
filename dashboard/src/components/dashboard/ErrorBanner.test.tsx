import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { ErrorBanner } from "@/components/dashboard/ErrorBanner";
import { renderWithProviders } from "@/test/test-utils";

describe("ErrorBanner", () => {
  it("renderiza el mensaje de error", () => {
    renderWithProviders(<ErrorBanner message="Error de conexión" />);
    expect(screen.getByText("Error de conexión")).toBeInTheDocument();
  });
});
