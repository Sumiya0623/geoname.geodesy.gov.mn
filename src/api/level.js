import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

export function useGetLevels(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.network.list(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      levels: data?.results || [],
      levelsEmpty: !isLoading && !data?.results?.length,
      levelsError: error,
      levelsCount: data?.count || 0,
      levelsLoading: isLoading,
      levelsMutation: mutate,
      levelsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetLevelsForTree(request_body) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.network.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    request_body ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      levels: data?.results || [],
      levelsEmpty: !isLoading && !data?.results?.length,
      levelsError: error,
      levelsCount: data?.count || 0,
      levelsLoading: isLoading,
      levelsMutation: mutate,
      levelsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetLevel(id) {
  const URL = endpoints.network.details(id);
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

// ----------------------------------------------------------------------

export function useGetLevelsFordropdown(query) {
  const queried_request_body = new URLSearchParams(query).toString();
  const URL = endpoints.network.dropdown(queried_request_body);
  const key = query ? [URL, axiosInstance, "get"] : null;
  const { data, isLoading, error, isValidating } = useSWR(key, fetcher);
  const memoizedValue = useMemo(
    () => ({
      levels: data?.results || [],
      levelsEmpty: !isLoading && !data?.results?.length,
      levelsError: error,
      levelsLoading: isLoading,
      levelsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}
// ----------------------------------------------------------------------
export function useGetLevelsForTasks(parent_id) {
  const request_body = { parent: parent_id || "" };
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.network.dropdown(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    parent_id ? [URL, axiosInstance, "get"] : null,
    fetcher
  );

  const memoizedValue = useMemo(
    () => ({
      levels: data?.results || [],
      levelsEmpty: !isLoading && !data?.results?.length,
      levelsError: error,
      levelsLoading: isLoading,
      levelsValidating: isValidating,
      levelsMutation: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}
