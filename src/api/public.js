import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

export function useGetStatus(year = "бүгд") {
  const URL = endpoints.public.status(year);

  const { data, isLoading, error, isValidating } = useSWR(
    year ? [URL, axiosInstance, "get"] : null,
    fetcher,
  );

  const memoizedValue = useMemo(
    () => ({
      status: data?.results || {},
      statusEmpty: !isLoading && !Object.keys(data || {}).length,
      statusError: error,
      statusLoading: isLoading,
      statusValidating: isValidating,
    }),
    [data, error, isLoading, isValidating],
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

// ----------------------------------------------------------------------

export function useGetStats(year) {
  const URL = endpoints.public.stats(year);

  const { data, isLoading, error, isValidating } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
  );

  const memoizedValue = useMemo(
    () => ({
      stats: data?.results || {},
      statsEmpty: !isLoading && !Object.keys(data || {}).length,
      statsError: error,
      statsLoading: isLoading,
      statsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating],
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetTimeline(year) {
  const URL = endpoints.public.timeline(year);

  const { data, isLoading, error, isValidating } = useSWR(
    year ? [URL, axiosInstance, "get"] : null,
    fetcher,
  );

  const memoizedValue = useMemo(
    () => ({
      timeline: data?.results || [],
      timelineEmpty: !isLoading && !Array.isArray(data?.results),
      timelineError: error,
      timelineLoading: isLoading,
      timelineValidating: isValidating,
    }),
    [data, error, isLoading, isValidating],
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetPurchaseStats(year) {
  const URL = endpoints.public.purchase(year);

  const { data, isLoading, error, isValidating } = useSWR(
    year ? [URL, axiosInstance, "get"] : null,
    fetcher,
  );

  const memoizedValue = useMemo(
    () => ({
      purchase: data?.results || {},
      purchaseLoading: isLoading,
      purchaseError: error,
      purchaseValidating: isValidating,
    }),
    [data, error, isLoading, isValidating],
  );

  return memoizedValue;
}
