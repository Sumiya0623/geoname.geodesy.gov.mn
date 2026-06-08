import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

export function useGetUnits(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.unit.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );
  const memoizedValue = useMemo(
    () => ({
      units: data?.results || [],
      unitsEmpty: !isLoading && !data?.results?.length,
      unitsError: error,
      unitsCount: data?.count || 0,
      unitsLoading: isLoading,
      unitsMutation: mutate,
      unitsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetUnit(id) {
  const URL = endpoints.unit.details(id);
  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher
  );
  const memoizedValue = useMemo(
    () => ({
      unit: data || {},
      unitError: error,
      unitLoading: isLoading,
      unit: data || {},
      unitValidating: isValidating,
      unitEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetUnitsFordropdown(query) {
  const queried_request_body = new URLSearchParams(query).toString();
  const URL = endpoints.unit.dropdown(queried_request_body);
  const key = query ? [URL, axiosInstance, "get"] : null;
  const { data, isLoading, error, isValidating } = useSWR(key, fetcher);
  const memoizedValue = useMemo(
    () => ({
      units: data?.results || [],
      unitsEmpty: !isLoading && !data?.results?.length,
      unitsError: error,
      unitsLoading: isLoading,
      unitsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );
  return memoizedValue;
}

export function useSearchUnits(query) {
  const request_body = { unit: query };
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.unit.dropdown(queried_request_body);

  const { data, isLoading, error, isValidating } = useSWR(
    query ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      units: data?.results || [],
      unitsEmpty: !isLoading && !data?.results?.length,
      unitsError: error,
      unitsLoading: isLoading,
      unitsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetUnitsForPoints(query) {
  const queried_request_body = new URLSearchParams(query).toString();
  const URL = endpoints.pointFilter.unit(queried_request_body);
  const key = query ? [URL, axiosInstance, "get"] : null;
  const { data, isLoading, error, isValidating } = useSWR(key, fetcher);
  const memoizedValue = useMemo(
    () => ({
      units: data?.results || [],
      unitsEmpty: !isLoading && !data?.results?.length,
      unitsError: error,
      unitsLoading: isLoading,
      unitsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}
