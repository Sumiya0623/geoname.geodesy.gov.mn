import axios from "axios";

export function getAxiosErrorMessage(err) {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (!data) return err.message || "Unknown error";

    if (typeof data === "string") return data;
    if (Array.isArray(data)) return data.join("\n");
    if (data.result) return String(data.result);
    if (data.detail) return String(data.detail);
    if (data.results) {
      return Array.isArray(data.results)
        ? data.results.join("\n")
        : typeof data.results === "string"
          ? data.results
          : JSON.stringify(data.results);
    }
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return first.join("\n");
    if (typeof first === "string") return first;
    return JSON.stringify(data);
  }
  return err?.message || "Unexpected error";
}
