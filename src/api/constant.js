import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

export function useGetConstants(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.constant.list(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    request_body ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      constants: data?.results || [],
      constantsEmpty: !isLoading && !data?.results?.length,
      constantsError: error,
      constantsCount: data?.count || 0,
      constantsLoading: isLoading,
      constantsMutation: mutate,
      constantsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}
export function useGetConstant(id) {
  const URL = endpoints.constant.details(id);

  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher
  );

  const memoizedValue = useMemo(
    () => ({
      constantError: error,
      constantLoading: isLoading,
      constant: data || {},
      constantValidating: isValidating,
      constantEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetMenus(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.constant.menus(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    request_body ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      menus: data?.results || [],
      menusEmpty: !isLoading && !data?.results?.length,
      menusError: error,
      menusCount: data?.count || 0,
      menusLoading: isLoading,
      menusMutation: mutate,
      menusValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

export function useGetConstantsFordropdown(key) {
  const request_body = { key };
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.constant.dropdown(queried_request_body);
  const { data, isLoading, error, isValidating } = useSWR(
    key ? [URL, axiosInstance, "get"] : null,
    fetcher
  );

  const memoizedValue = useMemo(
    () => ({
      constants: data?.results || [],
      constantsEmpty: !isLoading && !data?.results?.length,
      constantsError: error,
      constantsLoading: isLoading,
      constantsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}
export function useGetConstantsForParent(parent) {
  const request_body = { parent };
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.constant.dropdown(queried_request_body);
  const { data, isLoading, error, isValidating } = useSWR(
    parent ? [URL, axiosInstance, "get"] : null,
    fetcher
  );
  const memoizedValue = useMemo(
    () => ({
      constants: data?.results || [],
      constantsEmpty: !isLoading && !data?.results?.length,
      constantsError: error,
      constantsLoading: isLoading,
      constantsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );
  return memoizedValue;
}

export function useGetConstantsSystem(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.pointFilter.systemreg(queried_request_body);
  const { data, isLoading, error, isValidating } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher
  );

  const memoizedValue = useMemo(
    () => ({
      constants: data?.results || [],
      constantsEmpty: !isLoading && !data?.results?.length,
      constantsError: error,
      constantsLoading: isLoading,
      constantsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetConstantsNetwork(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.pointFilter.networkreg(queried_request_body);
  const { data, isLoading, error, isValidating } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher
  );
  const memoizedValue = useMemo(
    () => ({
      constants: data?.results || [],
      constantsEmpty: !isLoading && !data?.results?.length,
      constantsError: error,
      constantsLoading: isLoading,
      constantsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetNomeks(request_body) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.pointFilter.nomek(queried_request_body);
  const { data, isLoading, error, isValidating } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher
  );

  const memoizedValue = useMemo(
    () => ({
      nomeks: data?.results || [],
      nomeksEmpty: !isLoading && !data?.results?.length,
      nomeksError: error,
      nomeksLoading: isLoading,
      nomeksValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetGeoServerFields(field) {
  const request_body = { field };
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.constant.geoserverfields(queried_request_body);
  const { data, isLoading, error, isValidating } = useSWR(
    field ? [URL, axiosInstance, "get"] : null,
    fetcher
  );

  const memoizedValue = useMemo(
    () => ({
      fields: data?.results || [],
      fieldsEmpty: !isLoading && !data?.results?.length,
      fieldsError: error,
      fieldsLoading: isLoading,
      fieldsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetStatuses(key, pointId) {
  const request_body = {
    key,
    ...(pointId ? { items__point__in: pointId } : {}),
  };
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.status.list(queried_request_body);
  const { data, isLoading, error, isValidating } = useSWR(
    key ? [URL, axiosInstance, "get"] : null,
    fetcher
  );

  const memoizedValue = useMemo(
    () => ({
      statuses: data?.results || [],
      statusesEmpty: !isLoading && !data?.results?.length,
      statusesError: error,
      statusesLoading: isLoading,
      statusesValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetNumbers(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.number.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    request_body ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );
  const memoizedValue = useMemo(
    () => ({
      numbers: data?.results || [],
      numbersEmpty: !isLoading && !data?.results?.length,
      numbersError: error,
      numbersCount: data?.count || 0,
      numbersLoading: isLoading,
      numbersMutation: mutate,
      numbersValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

export function useGetConstantsForStatus(key) {
  const request_body = { key };
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.constant.status(queried_request_body);
  const { data, isLoading, error, isValidating } = useSWR(
    key ? [URL, axiosInstance, "get"] : null,
    fetcher
  );
  const memoizedValue = useMemo(
    () => ({
      constants: data?.results || [],
      constantsEmpty: !isLoading && !data?.results?.length,
      constantsError: error,
      constantsLoading: isLoading,
      constantsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetRole(id) {
  const URL = endpoints.constant.role(id);
  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher
  );
  const memoizedValue = useMemo(
    () => ({
      roleError: error,
      roleLoading: isLoading,
      role: data || {},
      roleValidating: isValidating,
      roleEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}
