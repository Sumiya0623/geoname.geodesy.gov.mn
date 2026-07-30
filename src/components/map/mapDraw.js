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

// ── Байрлал (геометр) засах гүүр ──
// Map2 нь startEditGeom‑оо бүртгэнэ; popup (NameDetailCard) нь
// requestMapEditGeom(geonameId) дуудаж, QGIS маягаар vertex/цэг засаад,
// "Хадгалах" (commitMapEdit) эсвэл "Болих"/ESC (cancelMapEdit) хийнэ.
// Promise нь засагдсан геометрийг (GeoJSON, EPSG:4326) эсвэл null (болих) буцаана.
let _editGeomFn = null;
export function registerMapEditGeom(fn) {
  _editGeomFn = fn;
}
export function requestMapEditGeom(geonameId) {
  if (typeof _editGeomFn !== "function") return Promise.resolve(null);
  return _editGeomFn(geonameId);
}
export function commitMapEdit() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("geoname:editCommit"));
}
export function cancelMapEdit() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("geoname:editCancel"));
}

// Recount давхаргыг (WFS vector) дахин ачаалах гүүр — popup дээр recount засах/
// устгасны дараа газрын зургийг шинэчлэхэд.
let _recountReloadFn = null;
export function registerRecountReload(fn) {
  _recountReloadFn = fn;
}
export function requestRecountReload() {
  if (typeof _recountReloadFn === "function") _recountReloadFn();
  // RecountPanel‑ийн type‑модыг ч шинэчлэхийн тулд дохио тараана (шинэ type‑ийн
  // recount нэмэгдвэл мод + CQL шинэчлэгдэж газрын зурагт орж ирнэ).
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("recount:changed"));
  }
}

// ── Түр зурсан геометрийг зурагнаас арилгах гүүр ──
// Форм дээр хадгалсны дараа (эсвэл болиход) зурсан түр дүрсийг цэвэрлэнэ —
// бодит объект нь recount давхаргаас дахин ачаалагдаж харагдана.
let _clearDrawFn = null;
export function registerClearDraw(fn) {
  _clearDrawFn = fn;
}
export function requestClearDraw() {
  if (typeof _clearDrawFn === "function") _clearDrawFn();
}
