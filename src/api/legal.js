import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
// Тогтоол, шийдвэрийн сан (LegalOrder) + төрөл (LEGAL_TYPES) карт
// ----------------------------------------------------------------------

// AdminUnit dropdown — level='aimag' (Аймаг/Нийслэл) эсвэл level='sum' (Сум/Дүүрэг, parent=аймаг)
export function useGetLegalUnits(level, parentId, enabled = true) {
  const params = new URLSearchParams({ level: level || "" });
  if (parentId) params.append("parent", parentId);
  const URL = endpoints.legal.units(params.toString());
  const { data, isLoading } = useSWR(
    enabled && level ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );
  return { units: data?.results || [], unitsLoading: isLoading };
}

export function useGetLegalTypes() {
  const URL = endpoints.legal.types("");

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );

  return useMemo(
    () => ({
      legalTypes: data?.results || [],
      legalTypesLoading: isLoading,
      legalTypesError: error,
      legalTypesMutation: mutate,
      legalTypesValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

export function useGetLegalOrders(request_body = null) {
  const query = request_body
    ? new URLSearchParams(request_body).toString()
    : "";
  const URL = endpoints.legal.list(query);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    request_body ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  return useMemo(
    () => ({
      legalOrders: data?.results || [],
      legalOrdersEmpty: !isLoading && !data?.results?.length,
      legalOrdersError: error,
      legalOrdersCount: data?.count ?? data?.results?.length ?? 0,
      legalOrdersLoading: isLoading,
      legalOrdersMutation: mutate,
      legalOrdersValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}
