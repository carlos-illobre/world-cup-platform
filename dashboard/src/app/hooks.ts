import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/app/store";

/**
 * Hooks tipados de Redux para usar en toda la aplicación.
 * Usar estos en vez de los genéricos de react-redux.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
