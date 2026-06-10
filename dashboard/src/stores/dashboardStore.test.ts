import { beforeEach, describe, expect, it } from "vitest";
import { useDashboardStore } from "@/stores/dashboardStore";

describe("dashboardStore", () => {
  beforeEach(() => {
    useDashboardStore.setState({
      selectedDate: null,
      selectedMatchNumber: null,
      selectedPlayerName: null,
    });
  });

  it("inicia sin selección", () => {
    const state = useDashboardStore.getState();
    expect(state.selectedDate).toBeNull();
    expect(state.selectedMatchNumber).toBeNull();
    expect(state.selectedPlayerName).toBeNull();
    expect(state.hasCompleteSelection()).toBe(false);
  });

  it("resetea partido y jugador al cambiar la fecha", () => {
    useDashboardStore.getState().setSelectedDate("2026-06-11");
    useDashboardStore.getState().setSelectedMatchNumber(1);
    useDashboardStore.getState().setSelectedPlayerName("K. De Bruyne");

    useDashboardStore.getState().setSelectedDate("2026-06-15");

    const state = useDashboardStore.getState();
    expect(state.selectedDate).toBe("2026-06-15");
    expect(state.selectedMatchNumber).toBeNull();
    expect(state.selectedPlayerName).toBeNull();
  });

  it("resetea jugador al cambiar el partido", () => {
    useDashboardStore.getState().setSelectedMatchNumber(1);
    useDashboardStore.getState().setSelectedPlayerName("K. De Bruyne");

    useDashboardStore.getState().setSelectedMatchNumber(2);

    const state = useDashboardStore.getState();
    expect(state.selectedMatchNumber).toBe(2);
    expect(state.selectedPlayerName).toBeNull();
  });

  it("detecta selección completa cuando hay partido y jugador", () => {
    useDashboardStore.getState().setSelectedMatchNumber(1);
    useDashboardStore.getState().setSelectedPlayerName("K. De Bruyne");
    expect(useDashboardStore.getState().hasCompleteSelection()).toBe(true);
  });
});
