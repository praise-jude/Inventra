"use client";

// Same-tab broadcast for "something stock/product related changed" so
// pieces of the UI that don't share React state (e.g. the Topbar alert
// bell) can refresh without waiting for a route navigation.
const DATA_CHANGED_EVENT = "inventra:data-changed";

export function notifyDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}

export function onDataChanged(callback: () => void): () => void {
  window.addEventListener(DATA_CHANGED_EVENT, callback);
  return () => window.removeEventListener(DATA_CHANGED_EVENT, callback);
}
