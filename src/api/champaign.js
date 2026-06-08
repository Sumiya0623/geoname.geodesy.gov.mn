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

export function useGetProjectMeasurements(projectId, params = {}) {
  const query = new URLSearchParams(params).toString();
  const URL = endpoints.champaign.measurements(projectId, query);
  const shouldFetch = !!projectId;

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    shouldFetch ? [URL, axiosInstance, "get"] : null,
    fetcher,
  );

  const memoizedValue = useMemo(
    () => ({
      measurements: data?.results || data || [],
      measurementsCount: data?.count,
      measurementsError: error,
      measurementsLoading: isLoading,
      measurementsValidating: isValidating,
      measurementsMutation: mutate,
      measurementsEmpty:
        !isLoading &&
        !error &&
        (!data ||
          (!data?.results?.length && !Array.isArray(data) && !data.length)),
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

export function useGetOneChampaign(id) {
  const URL = endpoints.champaign.getone(id);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher,
  );

  const memoizedValue = useMemo(
    () => ({
      champaigns: data?.results || [],
      champaignsError: error,
      champaignsLoading: isLoading,
      champaignsValidating: isValidating,
      champaignsEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating],
  );

  return memoizedValue;
}
export function useGetChampaignsFordropdown(query) {
  const queried_request_body = new URLSearchParams(query).toString();
  const URL = endpoints.champaign.dropdown(queried_request_body);
  const key = query ? [URL, axiosInstance, "get"] : null;
  const { data, isLoading, error, isValidating } = useSWR(key, fetcher);
  const memoizedValue = useMemo(
    () => ({
      champaigns: data?.results || [],
      champaignsEmpty: !isLoading && !data?.results?.length,
      champaignsError: error,
      champaignsLoading: isLoading,
      champaignsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating],
  );

  return memoizedValue;
}

export function useGetActs(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.champaign.act.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false },
  );

  const memoizedValue = useMemo(
    () => ({
      acts: data?.results || [],
      actsEmpty: !isLoading && !data?.results?.length,
      actsError: error,
      actsCount: data?.count || 0,
      actsLoading: isLoading,
      actsMutation: mutate,
      actsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate],
  );

  return memoizedValue;
}

export function useGetAct(id) {
  const URL = endpoints.champaign.act.details(id);
  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher,
  );
  const memoizedValue = useMemo(
    () => ({
      act: data || {},
      actError: error,
      actLoading: isLoading,
      act: data || {},
      actValidating: isValidating,
      actEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating],
  );

  return memoizedValue;
}
