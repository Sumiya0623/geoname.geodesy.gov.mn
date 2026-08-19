import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
// Газар зүйн нэр (GeoName) + төрлийн картууд (GEONAME_TYPES)
// ----------------------------------------------------------------------

export function useGetGeonameTypes() {
  const { data, isLoading, error, mutate } = useSWR(
    [endpoints.geoname.types, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false },
  );
  return useMemo(
    () => ({
      types: data?.results || [],
      typesLoading: isLoading,
      typesError: error,
      typesMutation: mutate,
    }),
    [data, error, isLoading, mutate],
  );
}

export function useGetGeonames(request_body = null) {
  const query = request_body
    ? new URLSearchParams(request_body).toString()
    : "";
  const URL = endpoints.geoname.list(query);
  const { data, isLoading, error, mutate, isValidating } = useSWR(
    request_body ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false },
  );
  return useMemo(
    () => ({
      geonames: data?.results || [],
      geonamesEmpty: !isLoading && !data?.results?.length,
      geonamesCount: data?.count ?? data?.results?.length ?? 0,
      geonamesLoading: isLoading,
      geonamesError: error,
      geonamesMutation: mutate,
      geonamesValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate],
  );
}

// ----------------------------------------------------------------------
// Нүүр хуудасны газрын зураг — ЗЗ нэгж бүрийн газар зүйн нэрийн тоо.
// parent байхгүй → аймаг + нийслэл, parent=<id> → тухайн аймгийн сум/дүүрэг.
// Нэвтрэлтгүй уншина (AllowAny), backend талд 30 мин cache-тэй.
// ----------------------------------------------------------------------

export function useGetNameStat(parent = null) {
  const URL = endpoints.geoname.nameStat(parent);
  const { data, isLoading, error } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  return useMemo(
    () => ({
      stat: data || null,
      statLoading: isLoading,
      statError: error,
    }),
    [data, error, isLoading],
  );
}

// Онцлох нэрс (хамгийн их давтагдсан / урт / богино) — сонгосон нутгаар
export function useGetNameFacts(unit = null) {
  const URL = endpoints.geoname.nameFacts(unit);
  const { data, isLoading, error } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  return useMemo(
    () => ({
      facts: data || null,
      factsLoading: isLoading,
      factsError: error,
    }),
    [data, error, isLoading],
  );
}
