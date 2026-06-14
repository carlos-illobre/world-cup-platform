import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/app/store";

interface FixtureState {
  /** ID de la fecha de jornada seleccionada (ej: "2026-06-14") */
  fechaSeleccionada: string | null;
  /** Número de partido seleccionado */
  numeroPartidoSeleccionado: number | null;
}

const initialState: FixtureState = {
  fechaSeleccionada: null,
  numeroPartidoSeleccionado: null,
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
    },
    seleccionarPartido(state, action: PayloadAction<number>) {
      state.numeroPartidoSeleccionado = action.payload;
    },
    resetearFixture(state) {
      state.fechaSeleccionada = null;
      state.numeroPartidoSeleccionado = null;
    },
  },
});

export const { seleccionarFecha, seleccionarPartido, resetearFixture } = fixtureSlice.actions;

// Selectores
export const selectFechaSeleccionada = (state: RootState) =>
  state.fixture.fechaSeleccionada;
export const selectNumeroPartidoSeleccionado = (state: RootState) =>
  state.fixture.numeroPartidoSeleccionado;

export default fixtureSlice.reducer;
