import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

export function useGetOrders(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.order.list(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      orders: data?.results || [],
      ordersEmpty: !isLoading && !data?.results?.length,
      ordersError: error,
      ordersCount: data?.count || 0,
      ordersLoading: isLoading,
      ordersMutation: mutate,
      ordersValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetOrder(id) {
  const URL = endpoints.order.details(id);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher
  );

  const memoizedValue = useMemo(
    () => ({
      orderError: error,
      orderLoading: isLoading,
      order: data || {},
      orderValidating: isValidating,
      orderMutation: mutate,
      orderEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}
