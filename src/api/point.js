import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

export function useGetPoints(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.point.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      points: data?.results || [],
      pointsEmpty: !isLoading && !data?.results?.length,
      pointsError: error,
      pointsCount: data?.count || 0,
      pointsLoading: isLoading,
      pointsMutation: mutate,
      pointsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

// BARIMT ----------------------------------------------------------------------

export function useGetPoint(id) {
  const URL = endpoints.point.details(id);
  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher
  );
  const memoizedValue = useMemo(
    () => ({
      point: data || {},
      pointError: error,
      pointLoading: isLoading,
      point: data || {},
      pointValidating: isValidating,
      pointEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}
export function useSearchPoints(query) {
  const request_body = { name: query };
  const queried_request_body = new URLSearchParams(request_body);
  const URL = endpoints.point.dropdown(queried_request_body);
  const { data, isLoading, error, isValidating } = useSWR(
    query ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      points: data?.results || [],
      pointsEmpty: !isLoading && !data?.results?.length,
      pointsError: error,
      pointsLoading: isLoading,
      pointsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetMonposPoints(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.point.monpos.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      points: data?.results || [],
      pointsEmpty: !isLoading && !data?.results?.length,
      pointsError: error,
      pointsCount: data?.count || 0,
      pointsLoading: isLoading,
      pointsMutation: mutate,
      pointsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

export function useGetMonposPoint(id) {
  const URL = endpoints.point.monpos.details(id);
  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher
  );
  const memoizedValue = useMemo(
    () => ({
      point: data || {},
      pointError: error,
      pointLoading: isLoading,
      point: data || {},
      pointValidating: isValidating,
      pointEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetCounts(request_body = {}) {
  const hasRequestBody =
    request_body &&
    typeof request_body === "object" &&
    Object.keys(request_body).length > 0;

  // Хэрэв project (projectId) ирсэн бол тухайн төслийн ReCount-уудыг
  // /api/point/project/{id}/counts/ endpoint-оор дуудаж хэрэглэнэ.
  const projectId = request_body?.project;
  const params = { ...(request_body || {}) };
  if (projectId !== undefined) {
    delete params.project;
  }

  const queried_request_body =
    hasRequestBody && Object.keys(params).length > 0
      ? new URLSearchParams(params).toString()
      : "";

  const URL = hasRequestBody
    ? projectId !== undefined
      ? endpoints.champaign.counts(projectId, queried_request_body)
      : endpoints.point.count.list(queried_request_body)
    : endpoints.point.count.list("");
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    hasRequestBody || !queried_request_body
      ? [URL, axiosInstance, "get"]
      : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      counts: data?.results || [],
      countsEmpty: !isLoading && !data?.results?.length,
      countsError: error,
      countsCount: data?.count || 0,
      countsLoading: isLoading,
      countsMutation: mutate,
      countsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

// BARIMT ----------------------------------------------------------------------

export function useGetCount(id) {
  const URL = endpoints.point.count.details(id);
  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher
  );
  const memoizedValue = useMemo(
    () => ({
      count: data || {},
      countError: error,
      countLoading: isLoading,
      count: data || {},
      countValidating: isValidating,
      countEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}
