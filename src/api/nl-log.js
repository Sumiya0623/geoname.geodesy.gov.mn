import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
export function useGetIntents(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.point.nl.intent(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );
  const memoizedValue = useMemo(
    () => ({
      intents: data?.results || [],
      intentsEmpty: !isLoading && !data?.results?.length,
      intentsError: error,
      intentsCount: data?.count || 0,
      intentsLoading: isLoading,
      intentsMutation: mutate,
      intentsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
  return memoizedValue;
}

export function useGetLogs(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.point.nl.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );
  const memoizedValue = useMemo(
    () => ({
      logs: data?.results || [],
      logsEmpty: !isLoading && !data?.results?.length,
      logsError: error,
      logsCount: data?.count || 0,
      logsLoading: isLoading,
      logsMutation: mutate,
      logsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetLog(id) {
  const URL = endpoints.nl.details(id);
  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher
  );
  const memoizedValue = useMemo(
    () => ({
      log: data || {},
      logError: error,
      logLoading: isLoading,
      log: data || {},
      logValidating: isValidating,
      logEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetLogsFordropdown(query) {
  const queried_request_body = new URLSearchParams(query).toString();
  const URL = endpoints.nl.dropdown(queried_request_body);
  const key = query ? [URL, axiosInstance, "get"] : null;
  const { data, isLoading, error, isValidating } = useSWR(key, fetcher);
  const memoizedValue = useMemo(
    () => ({
      logs: data?.results || [],
      logsEmpty: !isLoading && !data?.results?.length,
      logsError: error,
      logsLoading: isLoading,
      logsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useSearchLogs(query) {
  const request_body = { log: query };
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.log.dropdown(queried_request_body);

  const { data, isLoading, error, isValidating } = useSWR(
    query ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      logs: data?.results || [],
      logsEmpty: !isLoading && !data?.results?.length,
      logsError: error,
      logsLoading: isLoading,
      logsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}
