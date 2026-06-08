import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

export function useGetNames(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.name.list(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      names: data?.results || [],
      namesEmpty: !isLoading && !data?.results?.length,
      namesError: error,
      namesCount: data?.count || 0,
      namesLoading: isLoading,
      namesMutation: mutate,
      namesValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetName(id) {
  const URL = endpoints.name.details(id);
  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher
  );
  const memoizedValue = useMemo(
    () => ({
      name: data || {},
      nameError: error,
      nameLoading: isLoading,
      name: data || {},
      nameValidating: isValidating,
      nameEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetNamesFordropdown(query) {
  const queried_request_body = new URLSearchParams(query).toString();
  const URL = endpoints.name.list(queried_request_body);

  const { data, isLoading, error, isValidating } = useSWR(
    query ? [URL, axiosInstance, 'get'] : null,
    fetcher,
    { shouldRetryOnError: false }
  );
  const memoizedValue = useMemo(
    () => ({
      names: data?.results || [],
      namesEmpty: !isLoading && !data?.results?.length,
      namesError: error,
      namesLoading: isLoading,
      namesValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}
