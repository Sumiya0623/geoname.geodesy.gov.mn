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

// Газрын зургийн одоогийн харагдах хүрээг (EPSG:4326 [minx,miny,maxx,maxy])
// авах гүүр. Map2 mount үедээ бүртгэнэ; форм getMapExtent()‑ээр авна.
let _extentFn = null;
export function registerMapExtent(fn) {
  _extentFn = fn;
}
export function getMapExtent() {
  return typeof _extentFn === "function" ? _extentFn() : null;
}
