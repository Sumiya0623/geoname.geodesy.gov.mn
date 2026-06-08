import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

export function useGetMeasurements(request_body) {
  const hasRequestBody =
    request_body &&
    typeof request_body === "object" &&
    Object.keys(request_body).length > 0;

  // Хэрэв project (projectId) ирсэн бол тухайн төслийн хэмжилтийг
  // /api/point/project/{id}/measurements/ endpoint-оор дуудаж хэрэглэнэ.
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
      ? endpoints.champaign.measurements(projectId, queried_request_body)
      : endpoints.measurement.list(queried_request_body)
    : null;
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    hasRequestBody ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      measurements: data?.results || [],
      measurementsEmpty: !isLoading && !data?.results?.length,
      measurementsError: error,
      measurementsCount: data?.count || 0,
      measurementsLoading: hasRequestBody ? isLoading : false,
      measurementsMutation: mutate,
      measurementsValidating: isValidating,
    }),
    [data, error, hasRequestBody, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetMeasurement(id) {
  const URL = endpoints.measurement.details(id);
  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher
  );

  const memoizedValue = useMemo(
    () => ({
      measurement: data || {},
      measurementError: error,
      measurementLoading: isLoading,
      measurement: data || {},
      measurementValidating: isValidating,
      measurementEmpty:
        !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetMeasurementsFordropdown(query) {
  const queried_request_body = new URLSearchParams(query).toString();
  const URL = endpoints.measurement.dropdown(queried_request_body);
  const key = query ? [URL, axiosInstance, "get"] : null;
  const { data, isLoading, error, isValidating } = useSWR(key, fetcher);
  const memoizedValue = useMemo(
    () => ({
      measurements: data?.results || [],
      measurementsEmpty: !isLoading && !data?.results?.length,
      measurementsError: error,
      measurementsLoading: isLoading,
      measurementsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetReports(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.report.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );
  const memoizedValue = useMemo(
    () => ({
      reports: data?.results || [],
      reportsEmpty: !isLoading && !data?.results?.length,
      reportsError: error,
      reportsCount: data?.count || 0,
      reportsLoading: isLoading,
      reportsMutation: mutate,
      reportsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
  return memoizedValue;
}

export function useGetNomeksForDropDown(query) {
  const queried_request_body = new URLSearchParams(query).toString();
  const URL = endpoints.pointFilter.nomek(queried_request_body);
  const key = query ? [URL, axiosInstance, "get"] : null;
  const { data, isLoading, error, isValidating } = useSWR(key, fetcher);
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

export function useGetRegisteredUnitsForDropDown(query) {
  const queried_request_body = new URLSearchParams(query).toString();
  const URL = endpoints.pointFilter.unit(queried_request_body);
  const key = query ? [URL, axiosInstance, "get"] : null;
  const { data, isLoading, error, isValidating } = useSWR(key, fetcher);
  const memoizedValue = useMemo(
    () => ({
      units: data?.results || [],
      unitsEmpty: !isLoading && !data?.results?.length,
      unitsError: error,
      unitsLoading: isLoading,
      unitsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetNetWorksForDropDown(query) {
  const queried_request_body = new URLSearchParams(query).toString();
  const URL = endpoints.pointFilter.networkreg(queried_request_body);
  const key = query ? [URL, axiosInstance, "get"] : null;
  const { data, isLoading, error, isValidating } = useSWR(key, fetcher);
  const memoizedValue = useMemo(
    () => ({
      networks: data?.results || [],
      networksEmpty: !isLoading && !data?.results?.length,
      networksError: error,
      networksLoading: isLoading,
      networksValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );
  return memoizedValue;
}

export function useGetSystemsForDropDown(query) {
  const queried_request_body = new URLSearchParams(query).toString();
  const URL = endpoints.pointFilter.systemreg(queried_request_body);
  const key = query ? [URL, axiosInstance, "get"] : null;
  const { data, isLoading, error, isValidating } = useSWR(key, fetcher);
  const memoizedValue = useMemo(
    () => ({
      systems: data?.results || [],
      systemsEmpty: !isLoading && !data?.results?.length,
      systemsError: error,
      systemsLoading: isLoading,
      systemsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );
  return memoizedValue;
}
