import { create } from "zustand";

interface DashboardSelectionState {
  selectedDate: string | null;
  selectedMatchNumber: number | null;
  selectedPlayerName: string | null;
  setSelectedDate: (date: string | null) => void;
  setSelectedMatchNumber: (matchNumber: number | null) => void;
  setSelectedPlayerName: (playerName: string | null) => void;
  hasCompleteSelection: () => boolean;
}

/**
 * Estado global de selección del dashboard (fecha, partido y jugador).
 * Fuente única de verdad para la interacción del usuario.
 */
export const useDashboardStore = create<DashboardSelectionState>((set, get) => ({
  selectedDate: null,
  selectedMatchNumber: null,
  selectedPlayerName: null,
  setSelectedDate: (date) =>
    set({
      selectedDate: date,
      selectedMatchNumber: null,
      selectedPlayerName: null,
    }),
  setSelectedMatchNumber: (matchNumber) =>
    set({
      selectedMatchNumber: matchNumber,
      selectedPlayerName: null,
    }),
  setSelectedPlayerName: (playerName) => set({ selectedPlayerName: playerName }),
  hasCompleteSelection: () => {
    const { selectedMatchNumber, selectedPlayerName } = get();
    return Boolean(selectedMatchNumber && selectedPlayerName);
  },
}));
