import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
// Дэвсгэр нэр (GEONAME_TYPES) ангиллын мод — key‑ээр үндсэн төрөл,
// эсвэл parent‑аар дэд ангиллыг (child_count‑той) татна.
// ----------------------------------------------------------------------

export function useGetNameClasses(request_body = null) {
  const query = request_body
    ? new URLSearchParams(request_body).toString()
    : "";
  const URL = endpoints.nameclass.list(query);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    request_body ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  return useMemo(
    () => ({
      nameClasses: data?.results || [],
      nameClassesEmpty: !isLoading && !data?.results?.length,
      nameClassesError: error,
      nameClassesCount: data?.count ?? data?.results?.length ?? 0,
      nameClassesLoading: isLoading,
      nameClassesMutation: mutate,
      nameClassesValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}
