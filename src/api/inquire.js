import { useMemo } from "react";
import useSWR from "swr";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

// TODO: CART INQUIRE UUSGEH
export function useGetInquire(id) {
  const URL = endpoints.inquire.check(id);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false },
  );

  const memoizedValue = useMemo(
    () => ({
      inquire: data?.results || {},
      inquireError: error,
      inquireCount: data?.count || 0,
      inquireLoading: isLoading,
      inquireMutation: mutate,
      inquireValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate],
  );

  return memoizedValue;
}

export function useGetPaymentInquire(id) {
  const URL = endpoints.inquire.payment(id);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false },
  );

  const memoizedValue = useMemo(
    () => ({
      inquire: data?.results || {},
      inquireError: error,
      inquireCount: data?.count || 0,
      inquireLoading: isLoading,
      inquireMutation: mutate,
      inquireValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate],
  );

  return memoizedValue;
}
