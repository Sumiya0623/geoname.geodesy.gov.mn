import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
// Иргэний нэрийн хүсэлт (RequestName)
// ----------------------------------------------------------------------

// Төлөвийн картууд — /api/core/status/?key=REQUEST_STATUS (count + color, "Нийт"-тэй)
export function useGetRequestStatuses() {
  const URL = endpoints.request.status("key=REQUEST_STATUS");
  const { data, isLoading, error, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );
  return useMemo(
    () => ({
      statuses: data?.results || [],
      statusesLoading: isLoading,
      statusesError: error,
      statusesMutation: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// Хүсэлтийн хүснэгт
export function useGetRequests(request_body = null) {
  const query = request_body
    ? new URLSearchParams(request_body).toString()
    : "";
  const URL = endpoints.request.list(query);
  const { data, isLoading, error, mutate, isValidating } = useSWR(
    request_body ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );
  return useMemo(
    () => ({
      requests: data?.results || [],
      requestsEmpty: !isLoading && !data?.results?.length,
      requestsCount: data?.count ?? data?.results?.length ?? 0,
      requestsLoading: isLoading,
      requestsError: error,
      requestsMutation: mutate,
      requestsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

// GeoName сонголт (нэрийн FK)
export function useGetGeonames(search = "") {
  const query = search ? `search=${encodeURIComponent(search)}` : "";
  const URL = endpoints.request.geonames(query);
  const { data, isLoading } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );
  return useMemo(
    () => ({
      geonames: data?.results || [],
      geonamesLoading: isLoading,
    }),
    [data, isLoading]
  );
}
