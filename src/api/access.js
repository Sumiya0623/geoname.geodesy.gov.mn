import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

export function useGetRequests(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.access.request(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, 'get'],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      requests: data?.results || [],
      requestsEmpty: !isLoading && !data?.results?.length,
      requestsError: error,
      requestsCount: data?.count || 0,
      requestsLoading: isLoading,
      requestsMutation: mutate,
      requestsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetRequestsLogin(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.access.login(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, 'get'],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      login: data?.results || [],
      loginEmpty: !isLoading && !data?.results?.length,
      loginError: error,
      loginCount: data?.count || 0,
      loginLoading: isLoading,
      loginMutation: mutate,
      loginValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetRequestsChart(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.access.requestChart(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, 'get'],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      reqCharts: data?.results || [],
      reqChartsEmpty: !isLoading && !data?.results?.length,
      reqChartsError: error,
      reqChartsCount: data?.count || 0,
      reqChartsLoading: isLoading,
      reqChartsMutation: mutate,
      reqChartsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetRequest(id) {
  const URL = `/api/account/request/${id}/`;

  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, 'get'] : null, 
    fetcher
  );

  const memoizedValue = useMemo(
    () => {
      if (!id) {
        return {
          request: {},
          requestEmpty: true,
          requestError: null,
          requestLoading: false,
          requestValidating: false,
        };
      }

      return {
        request: data || {},
        requestEmpty: !isLoading && !Object.keys(data || {}).length,
        requestError: error,
        requestLoading: isLoading,
        requestValidating: isValidating,
      };
    },
    [id, data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useSearchRequests(query) {
  const request_body = { register: query, pagination: false };
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.access.request(queried_request_body);
  const { data, isLoading, error, isValidating } = useSWR(
    query ? [URL, axiosInstance, 'get'] : null,
    fetcher,
    { shouldRetryOnError: false }
  );
  const memoizedValue = useMemo(
    () => ({
      requests: data?.results || [],
      requestsEmpty: !isLoading && !data?.results?.length,
      requestsError: error,
      requestsLoading: isLoading,
      requestsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetRequestsForDropdown(value) {
  const request_body = { value, pagination: false };
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.access.request(queried_request_body);
  const { data, isLoading, error, isValidating } = useSWR(
    value ? [URL, axiosInstance, 'get'] : null,
    fetcher
  );
  const memoizedValue = useMemo(
    () => ({
      requests: data?.results || [],
      requestsEmpty: !isLoading && !data?.results?.length,
      requestsError: error,
      requestsLoading: isLoading,
      requestsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}


// ----------------------------------------------------------------------

export function useGetAction(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.access.actionChart(queried_request_body);

  const { data, isLoading, error, isValidating } = useSWR(
    [URL, axiosInstance, 'get'],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      chart: data?.results || {},
      chartEmpty: !isLoading && !Object.keys(data || {}).length,
      chartError: error,
      chartLoading: isLoading,
      chartValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetActionChart(request_body = {}) {
  const hasParams = request_body && Object.keys(request_body).length > 0;
  const queried = hasParams ? new URLSearchParams(request_body).toString() : '';
  const URL = endpoints.access.actionChart(queried);

  const { data, isLoading, error, isValidating } = useSWR(
    hasParams ? [URL, axiosInstance, 'get'] : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      act: data?.results || {},
      actEmpty: !isLoading && !Object.keys(data || {}).length,
      actError: error,
      actLoading: isLoading,
      actValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetUserChart(request_body = {}) {
  const hasParams = request_body && Object.keys(request_body).length > 0;
  const queried = hasParams ? new URLSearchParams(request_body).toString() : '';
  const URL = endpoints.access.userChart(queried);

  const { data, isLoading, error, isValidating } = useSWR(
    request_body ? [URL, axiosInstance, 'get'] : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      chart: data?.results || {},
      chartEmpty: !isLoading && !Object.keys(data || {}).length,
      chartError: error,
      chartLoading: isLoading,
      chartValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetActionChartWithParams(request_body = {}) {
  return useGetActionChart(request_body)
}

export function useGetUserChartWithParams(request_body = {}) {
  return useGetUserChart(request_body)
}

