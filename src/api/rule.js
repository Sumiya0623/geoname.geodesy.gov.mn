import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
// GeoServer style rules — нэг nameclass leaf (layer)-ийн дүрмүүд.
// Backend StyleRuleViewSet.get_queryset нь `layer` query param-аар шүүнэ.
// ----------------------------------------------------------------------

export function useGetRules(layerId) {
  const queried_request_body = new URLSearchParams(
    layerId ? { layer: layerId } : {}
  ).toString();
  const URL = endpoints.geoserver.style.rule.list(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    layerId ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  return useMemo(
    () => ({
      rules: data?.results || data || [],
      rulesEmpty:
        !isLoading && !(data?.results?.length || (Array.isArray(data) && data.length)),
      rulesError: error,
      rulesCount: data?.count ?? (Array.isArray(data) ? data.length : 0),
      rulesLoading: isLoading,
      rulesMutation: mutate,
      rulesValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}
