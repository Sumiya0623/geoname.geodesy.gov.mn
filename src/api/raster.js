import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// Хэвлэлийн эх (PrintMap) жагсаалт
export function useGetRasters(request_body = {}) {
  const query = new URLSearchParams(request_body).toString();
  const URL = endpoints.raster.list(query);
  const { data, isLoading, error, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false },
  );
  return useMemo(
    () => ({
      rasters: data?.results || [],
      rastersCount: data?.count || 0,
      rastersEmpty: !isLoading && !(data?.results?.length),
      rastersError: error,
      rastersLoading: isLoading,
      rastersMutation: mutate,
    }),
    [data, error, isLoading, mutate],
  );
}

// Прогрессив сонголт: union-д хил залгаа нэгжүүд (level=aimag|sum, selected, parent)
export async function fetchAdjacentUnits({ level, selected = [], parent }) {
  const params = new URLSearchParams({ level });
  if (selected.length) params.set("selected", selected.join(","));
  if (parent) params.set("parent", parent);
  try {
    const res = await axiosInstance.get(endpoints.raster.adjacent(params.toString()));
    return res?.data?.results || [];
  } catch (e) {
    return [];
  }
}
