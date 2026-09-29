import axios from "axios";

// ----------------------------------------------------------------------
// Төв систем (geodesy.gov.mn) руу хандах суваг.
//
// Нэвтрэлтийн түлхүүрийг төв систем `.geodesy.gov.mn` домэйн дээр тавьдаг
// бөгөөд энэ систем яг тэр түлхүүрээр хэрэглэгчээ таньдаг. Тиймээс тусдаа
// нууц түлхүүр хэрэггүй — зөвхөн cookie-г дагуулж явуулахад хангалттай.
//
// Тохиргоо (.env, git-д ордоггүй):
//   NEXT_PUBLIC_MAIN_SYSTEM_ID=107   # төв систем дэх ЭНЭ системийн дугаар
//
// Төв системийн хаягийг тусад нь бичих шаардлагагүй: аль хэдийн байгаа
// NEXT_PUBLIC_PORTAL_URL (https://geodesy.gov.mn)-ийг ашиглана. Шаардвал
// NEXT_PUBLIC_MAIN_API-гаар дарж бичиж болно.
// ----------------------------------------------------------------------

const RAW_BASE =
  process.env.NEXT_PUBLIC_MAIN_API || process.env.NEXT_PUBLIC_PORTAL_URL || "";

// Төгсгөлийн "/" болон "/api"-г авч хаяна — доорх замууд өөрсдөө "/api"-аар эхэлнэ
export const MAIN_BASE = RAW_BASE.replace(/\/+$/, "").replace(/\/api$/, "");

export const MAIN_SYSTEM_ID = process.env.NEXT_PUBLIC_MAIN_SYSTEM_ID || "";

export const mainApi = axios.create({
  baseURL: MAIN_BASE,
  withCredentials: true,
});

export const mainFetcher = async (args) => {
  const [url, config] = Array.isArray(args) ? args : [args];
  const res = await mainApi.get(url, { ...config });
  return res.data;
};

export const mainEndpoints = {
  post: {
    list: (params) => `/api/news/post/?${params}`,
    systems: `/api/news/post/system/`,
  },
  ticket: {
    list: (params) => `/api/sys/ticket/?${params}`,
    create: `/api/sys/ticket/`,
    details: (id, params = "") => `/api/sys/ticket/${id}/?${params}`,
    reply: (id) => `/api/sys/ticket/${id}/reply/`,
    rate: (id) => `/api/sys/ticket/${id}/rate/`,
    stats: (params = "") => `/api/sys/ticket/stats/?${params}`,
  },
};

// Төв системд хадгалагдсан файлын бүтэн хаяг
export function mainFileUrl(path) {
  if (!path) return "";
  if (String(path).startsWith("http")) return path;
  return `${MAIN_BASE}${path}`;
}
