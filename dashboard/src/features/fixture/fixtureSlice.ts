import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/app/store";

interface FixtureState {
  /** ID de la fecha de jornada seleccionada (ej: "2026-06-14") */
  fechaSeleccionada: string | null;
  /** Número de partido seleccionado */
  numeroPartidoSeleccionado: number | null;
  /** Simulated teams for knockout matches: "TeamA,TeamB" */
  simulatedTeams: string | null;
}

const initialState: FixtureState = {
  fechaSeleccionada: null,
  numeroPartidoSeleccionado: null,
  simulatedTeams: null,
};

/**
 * Slice de selección del fixture del Mundial.
 * Al cambiar la fecha se resetea el partido seleccionado (y por cascada, el jugador).
 */
const fixtureSlice = createSlice({
  name: "fixture",
  initialState,
  reducers: {
    seleccionarFecha(state, action: PayloadAction<string>) {
      state.fechaSeleccionada = action.payload;
      state.numeroPartidoSeleccionado = null;
      state.simulatedTeams = null;
    },
    seleccionarPartido(state, action: PayloadAction<number>) {
      state.numeroPartidoSeleccionado = action.payload;
      state.simulatedTeams = null;
    },
    setSimulatedTeams(state, action: PayloadAction<string>) {
      state.simulatedTeams = action.payload;
    },
    resetearFixture(state) {
      state.fechaSeleccionada = null;
      state.numeroPartidoSeleccionado = null;
      state.simulatedTeams = null;
    },
  },
});

export const { seleccionarFecha, seleccionarPartido, setSimulatedTeams, resetearFixture } = fixtureSlice.actions;

// Selectores
export const selectFechaSeleccionada = (state: RootState) =>
  state.fixture.fechaSeleccionada;
export const selectNumeroPartidoSeleccionado = (state: RootState) =>
  state.fixture.numeroPartidoSeleccionado;
export const selectSimulatedTeams = (state: RootState) =>
  state.fixture.simulatedTeams;

export default fixtureSlice.reducer;
