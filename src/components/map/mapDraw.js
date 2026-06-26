// Map2 ↔ popup (NameDetailCard) хооронд зурах хүсэлтийг дамжуулах энгийн registry.
// Map2 нь mount үед startTypedDraw‑оо бүртгэнэ; popup нь requestMapDraw(type)
// дуудаж, зурсан геометрийг (GeoJSON, EPSG:4326) Promise‑оор авна.

let _drawFn = null;

export function registerMapDraw(fn) {
  _drawFn = fn;
}

// type: "Point" | "LineString" | "Polygon" → Promise<GeoJSON|null> (ESC → null)
export function requestMapDraw(type) {
  if (typeof _drawFn !== "function") return Promise.resolve(null);
  return _drawFn(type);
}

export function isMapDrawReady() {
  return typeof _drawFn === "function";
}
