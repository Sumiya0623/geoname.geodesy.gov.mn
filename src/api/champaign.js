import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

export function useGetChampaigns(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.champaign.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false },
  );

  const memoizedValue = useMemo(
    () => ({
      champaigns: data?.results || [],
      champaignsEmpty: !isLoading && !data?.results?.length,
      champaignsError: error,
      champaignsCount: data?.count || 0,
      champaignsLoading: isLoading,
      champaignsMutation: mutate,
      champaignsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate],
  );

  return memoizedValue;
}

export function useGetChampaign(id) {
  const URL = endpoints.champaign.details(id);
  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher,
  );
  const memoizedValue = useMemo(
    () => ({
      champaign: data || {},
      champaignError: error,
      champaignLoading: isLoading,
      champaign: data || {},
      champaignValidating: isValidating,
      champaignEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating],
  );

  return memoizedValue;
}
