// Recount төлөв бүрийн өнгө. ЭХ СУРВАЛЖ нь Constant (RECOUNT_STATUS) дээрх
// `color` талбар — газрын зураг (нэрний доорх өнгөт зураас), legend болон
// popup/хүснэгтийн chip бүгд ижил өнгийг ашиглана.
// Constant дээр өнгө тохируулаагүй бол доорх нэрээр таарах нөөц утга үйлчилнэ.

export const RECOUNT_STATUS_COLORS = {
  "нэр зөрүүгүй": "#2563eb", // цэнхэр
  ижил: "#2563eb",
  уламжлалт: "#0d9488", // ногоон‑хөх
  "нэр зөрүүтэй": "#f59e0b", // улбар шар
  "байршил зөрүүтэй": "#dc2626", // улаан
  байршил: "#dc2626",
  "шинэ нэр": "#16a34a", // ногоон
  шинэ: "#16a34a",
  батлагдаагүй: "#f59e0b",
  алдаатай: "#7c3aed",
};

export const RECOUNT_STATUS_FALLBACK = "#64748b"; // тодорхойгүй → саарал

export function statusColorByName(name) {
  return (
    RECOUNT_STATUS_COLORS[(name || "").trim().toLowerCase()] ||
    RECOUNT_STATUS_FALLBACK
  );
}

// Constant объект (эсвэл нэр) → өнгө. DB дээрх color тэргүүн ээлжинд.
export function statusColor(status) {
  if (!status) return RECOUNT_STATUS_FALLBACK;
  if (typeof status === "string") return statusColorByName(status);
  const c = (status.color || "").trim();
  return c || statusColorByName(status.name);
}
