import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
// Дахин тооллого (ReCount) — суурин судалгааны таб
// ----------------------------------------------------------------------

export function useGetRecounts(request_body = null) {
  const query = request_body
    ? new URLSearchParams(request_body).toString()
    : "";
  const URL = endpoints.recount.list(query);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    request_body ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false },
  );

  return useMemo(
    () => ({
      recounts: data?.results || [],
      recountsEmpty: !isLoading && !data?.results?.length,
      recountsCount: data?.count ?? data?.results?.length ?? 0,
      recountsLoading: isLoading,
      recountsMutation: mutate,
      recountsValidating: isValidating,
      recountsError: error,
    }),
    [data, error, isLoading, isValidating, mutate],
  );
}

export function useGetRecountForms({
  projectId,
  step,
  sum,
  aimag,
  type,
  tab,
} = {}) {
  const params = new URLSearchParams();
  if (projectId) params.set("project", projectId);
  if (step) params.set("step", step);
  if (sum) params.set("sum_geom", sum);
  if (aimag) params.set("aimag_geom", aimag);
  if (type) params.set("type", type);
  // `tab` нь ЗӨВХӨН шүүлт (сум/аймаг/төрөл) идэвхтэй үед л backend‑д нөлөөлнө.
  // Шүүлтгүй үед URL‑д оруулахгүй → таб солих бүрд дахин татахгүй (тоонууд
  // 0 болоод буцаж ирэх анивчилт алга).
  const hasFilter = !!(sum || aimag || type);
  if (tab && hasFilter) params.set("tab", tab);
  const URL = `/api/r/recount/forms/?${params.toString()}`;
  const { data, isLoading, mutate } = useSWR(
    projectId ? [URL, axiosInstance, "get"] : null,
    fetcher,
    {
      shouldRetryOnError: false,
      // Дахин татах хооронд ХУУЧИН датаг хадгална (тоонууд 0 болж анивчихгүй)
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    },
  );
  return useMemo(
    () => ({
      forms: data || { 1: [], 2: [], 3: [], 4: [], 5: [] },
      formsLoading: isLoading,
      formsMutation: mutate,
    }),
    [data, isLoading, mutate],
  );
}

export function useGetRecountWms(projectId) {
  const query = projectId ? `project=${projectId}` : "";
  const URL = endpoints.recount.wms(query);
  const { data, isLoading, mutate } = useSWR(
    projectId ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false },
  );

  return useMemo(
    () => ({
      wmsInfo: data || null,
      wmsLoading: isLoading,
      wmsMutation: mutate,
    }),
    [data, isLoading, mutate],
  );
}
