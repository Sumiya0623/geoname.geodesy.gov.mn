// Recount төлөв бүрийн ДАВТАГДАШГҮЙ өнгө (нэрээр). Газрын зураг (нэрний доор
// өнгөт зураас) болон popup chip‑д хоёуланд ашиглана.

export const RECOUNT_STATUS_COLORS = {
  ижил: "#2563eb", // цэнхэр
  байршил: "#dc2626", // улаан
  батлагдаагүй: "#f59e0b", // улбар шар
  алдаатай: "#7c3aed", // ягаан
  шинэ: "#16a34a", // ногоон
};

export const RECOUNT_STATUS_FALLBACK = "#64748b"; // тодорхойгүй → саарал

export function statusColorByName(name) {
  return RECOUNT_STATUS_COLORS[(name || "").trim()] || RECOUNT_STATUS_FALLBACK;
}
