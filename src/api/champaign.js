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
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher,
  );
  const memoizedValue = useMemo(
    () => ({
      champaign: data || {},
      champaignError: error,
      champaignLoading: isLoading,
      champaignValidating: isValidating,
      champaignMutation: mutate,
      champaignEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating, mutate],
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------
// Төслийн ажлын талбай (ProjectArea) — газрын зураг дээр зурсан polygon‑ууд.
// Том хэмжээний зураглалын ажлыг талбайчлан хуваарилж, дуусгасныг тэмдэглэнэ.
export function useGetProjectAreas(projectId, enabled = true) {
  const URL = projectId ? endpoints.champaign.areas(projectId) : null;
  const { data, isLoading, error, mutate } = useSWR(
    URL && enabled ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false },
  );

  return useMemo(
    () => ({
      areas: Array.isArray(data) ? data : data?.results || [],
      areasLoading: isLoading,
      areasError: error,
      areasMutation: mutate,
    }),
    [data, error, isLoading, mutate],
  );
}
