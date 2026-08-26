import axiosInstance, { endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
// Хүсэлтийн А4 маягтыг (PDF) татах — 2 газраас (хүсэлтийн жагсаалт,
// профайлын лавлагаа) дуудагддаг тул нэг дор төвлөрүүлэв.
//
// URL нь тогтмол (/api/r/request/<id>/form/) тул браузер ХУУЧИН PDF-ээ
// кэшнээс өгч, маягт засагдсан ч өөрчлөгдөөгүй мэт харагддаг байв. Сервер
// талд Cache-Control: no-store тавьсан ч ӨМНӨ нь кэшлэгдсэн бичлэг үлддэг
// тул давхар цаг тэмдэглэсэн параметрээр баталгаажуулна.
//
// ТЭМДЭГЛЭЛ: `Cache-Control` хүсэлтийн толгойг нэмбэл CORS preflight шаардаж,
// backend-ийн CORS_ALLOW_HEADERS-т байхгүй тул унана — зөвхөн query ашиглав.
// ----------------------------------------------------------------------

/** Blob хэлбэрээр ирсэн алдааны хариунаас уншиж болох мессеж гаргана. */
async function extractError(error) {
  const d = error?.response?.data;
  if (d && typeof d.text === "function") {
    try {
      const text = await d.text();
      try {
        const j = JSON.parse(text);
        return j?.error?.message || j?.detail || "";
      } catch (e) {
        return text.slice(0, 200);
      }
    } catch (e) {
      /* уншиж чадсангүй */
    }
  }
  return d?.detail || error?.message || "";
}

/** Маягт үүсгэхэд 1-2 секунд зарцуулагддаг тул холболт тасрах магадлалтай.
 *  Хариу ОГТ ирээгүй (error.response байхгүй = «Network Error») үед НЭГ удаа
 *  дахин оролдоно; серверээс ирсэн бодит алдааг (403/500 г.м.) дахин
 *  оролдохгүй — тэр нь дарагдах ёсгүй. */
async function getBlob(url) {
  try {
    return await axiosInstance.get(url, { responseType: "blob" });
  } catch (error) {
    if (error?.response) throw error; // сервер хариулсан — дахин оролдохгүй
    await new Promise((r) => {
      setTimeout(r, 800);
    });
    return axiosInstance.get(url, { responseType: "blob" });
  }
}

/**
 * @param {number|string} id  RequestName id
 * @param {string} filename   Татагдах файлын нэр
 * @throws Алдааны шалтгааныг агуулсан Error (дуудагч нь харуулна)
 */
export async function downloadRequestForm(id, filename) {
  const url = `${endpoints.request.form(id)}?t=${Date.now()}`;
  let res;
  try {
    res = await getBlob(url);
  } catch (error) {
    const msg = await extractError(error);
    const status = error?.response?.status;
    throw new Error(
      [status ? `(${status})` : "", msg].filter(Boolean).join(" ") ||
        "сервер хариу өгсөнгүй",
    );
  }

  const href = window.URL.createObjectURL(
    new Blob([res.data], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(href);
}

export default downloadRequestForm;
