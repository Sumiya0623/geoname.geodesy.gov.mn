import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
// Газар зүйн нэрийн зөвлөлийн сан (Council) + гишүүд (CouncilMember)
// ----------------------------------------------------------------------

export function useGetCouncils(request_body = {}) {
  const query = new URLSearchParams(request_body).toString();
  const URL = endpoints.council.list(query);
  const { data, isLoading, error, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false },
  );
  return useMemo(
    () => ({
      councils: data?.results || [],
      councilsCount: data?.count || 0,
      councilsLoading: isLoading,
      councilsError: error,
      councilsMutation: mutate,
    }),
    [data, error, isLoading, mutate],
  );
}

export function useGetCouncilMembers(councilId, activeOnly = false) {
  const params = new URLSearchParams();
  if (councilId) params.set("council", councilId);
  if (activeOnly) params.set("active", "true");
  const URL = endpoints.council.members(params.toString());
  const { data, isLoading, mutate } = useSWR(
    councilId ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false },
  );
  return useMemo(
    () => ({
      members: data?.results || [],
      membersLoading: isLoading,
      membersMutation: mutate,
    }),
    [data, isLoading, mutate],
  );
}
