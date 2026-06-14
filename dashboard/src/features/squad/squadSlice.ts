import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/app/store";

interface SquadState {
  /** ID del jugador seleccionado para el diagnóstico de riesgo */
  jugadorSeleccionadoId: string | null;
}

const initialState: SquadState = {
  jugadorSeleccionadoId: null,
};

/**
 * Slice de selección del jugador.
 * Administra qué jugador está activo para el diagnóstico de riesgo.
 */
const squadSlice = createSlice({
  name: "squad",
  initialState,
  reducers: {
    seleccionarJugador(state, action: PayloadAction<string>) {
      state.jugadorSeleccionadoId = action.payload;
    },
    resetearJugadorSeleccionado(state) {
      state.jugadorSeleccionadoId = null;
    },
  },
});

export const { seleccionarJugador, resetearJugadorSeleccionado } = squadSlice.actions;

// Selectores
export const selectJugadorSeleccionadoId = (state: RootState) =>
  state.squad.jugadorSeleccionadoId;

export default squadSlice.reducer;
