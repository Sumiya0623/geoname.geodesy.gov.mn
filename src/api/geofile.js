import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

export function useGetGeoFiles(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.geofile.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      geofiles: data?.results || [],
      geofilesEmpty: !isLoading && !data?.results?.length,
      geofilesError: error,
      geofilesCount: data?.count || 0,
      geofilesLoading: isLoading,
      geofilesMutation: mutate,
      geofilesValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

export function useGetGeoFile(id) {
  const URL = endpoints.geofile.details(id);
  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher
  );
  const memoizedValue = useMemo(
    () => ({
      level: data || {},
      levelError: error,
      levelLoading: isLoading,
      level: data || {},
      levelValidating: isValidating,
      levelEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetGeoFilesFordropdown(query) {
  const queried_request_body = new URLSearchParams(query).toString();
  const URL = endpoints.geofile.dropdown(queried_request_body);
  const key = query ? [URL, axiosInstance, "get"] : null;
  const { data, isLoading, error, isValidating } = useSWR(key, fetcher);
  const memoizedValue = useMemo(
    () => ({
      geofiles: data?.results || [],
      geofilesEmpty: !isLoading && !data?.results?.length,
      geofilesError: error,
      geofilesLoading: isLoading,
      geofilesValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}
