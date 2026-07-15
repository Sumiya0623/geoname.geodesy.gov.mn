import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

export function useGetBaseMapLayers(requestBody = {}) {
  const queried = new URLSearchParams(requestBody).toString();
  const URL = endpoints.basemap.list(queried);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false },
  );

  return useMemo(
    () => ({
      layers: data?.results || [],
      layersCount: data?.count || 0,
      layersEmpty: !isLoading && !data?.results?.length,
      layersLoading: isLoading,
      layersError: error,
      layersValidating: isValidating,
      layersMutation: mutate,
    }),
    [data, error, isLoading, isValidating, mutate],
  );
}

// GeoServer raster/base workspace‑ийн давхаргууд (gs_layer сонгуулах)
export function useGetAvailableGsLayers() {
  const { data, isLoading, mutate } = useSWR(
    [endpoints.basemap.available(""), axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false, revalidateOnFocus: false },
  );
  return useMemo(
    () => ({
      available: data?.results || [],
      availableLoading: isLoading,
      availableMutation: mutate,
    }),
    [data, isLoading, mutate],
  );
}
