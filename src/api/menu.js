import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

export function useGetMenus(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.menu.list(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false },
  );

  const memoizedValue = useMemo(
    () => ({
      menus: data?.results || [],
      menusEmpty: !isLoading && !data?.results?.length,
      menusError: error,
      menusCount: data?.count || 0,
      menusLoading: isLoading,
      menusMutation: mutate,
      menusValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate],
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetMenusFordropdown() {
  const URL = endpoints.menu.dropdown;

  const { data, isLoading, error, isValidating } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    {
      shouldRetryOnError: false,
    },
  );

  const memoizedValue = useMemo(
    () => ({
      menus: data?.results || [],
      menusError: error,
      menusEmpty: !isLoading && !data?.results?.length,
      menusLoading: isLoading,
      menusValidating: isValidating,
    }),
    [data, error, isLoading, isValidating],
  );

  return memoizedValue;
}
