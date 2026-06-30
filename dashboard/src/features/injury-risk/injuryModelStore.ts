/**
 * Lightweight store for the selected injury model algorithm.
 * Used to coordinate between InjuryRiskPage (selector) and
 * InjuryRiskDashboard (query consumer) without prop drilling.
 */

let _currentModel: "xgboost" | "random_forest" = "xgboost";
const _listeners: Set<() => void> = new Set();

export function getInjuryModel(): "xgboost" | "random_forest" {
  return _currentModel;
}

export function setInjuryModel(model: "xgboost" | "random_forest") {
  if (_currentModel !== model) {
    _currentModel = model;
    _listeners.forEach((fn) => fn());
  }
}

export function subscribeInjuryModel(listener: () => void): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}
