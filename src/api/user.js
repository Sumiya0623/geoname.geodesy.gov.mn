import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

export function useGetUsers(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.user.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      users: data?.results || [],
      usersEmpty: !isLoading && !data?.results?.length,
      usersError: error,
      usersCount: data?.count || 0,
      usersLoading: isLoading,
      usersMutation: mutate,
      usersValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

export function useGetUser(id) {
  const URL = endpoints.user.details(id);
  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher
  );
  const memoizedValue = useMemo(
    () => ({
      user: data || {},
      userEmpty: !isLoading && !Object.keys(data || {}).length,
      userError: error,
      userLoading: isLoading,
      userValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useSearchUsers(query) {
  const request_body = { register: query };
  const queried_request_body = new URLSearchParams(request_body);
  const URL = endpoints.user.dropdown(queried_request_body);
  const { data, isLoading, error, isValidating } = useSWR(
    query ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );
  const memoizedValue = useMemo(
    () => ({
      users: data?.results || [],
      usersEmpty: !isLoading && !data?.results?.length,
      usersError: error,
      usersLoading: isLoading,
      usersValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetUserInfo() {
  const URL = endpoints.user.info;
  const { data, isLoading, error, isValidating } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    {
      shouldRetryOnError: false,
    }
  );
  const memoizedValue = useMemo(
    () => ({
      user: data || {},
      userEmpty: !isLoading && !Object.keys(data || {}).length,
      userError: error,
      userLoading: isLoading,
      userValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );
  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetUsersFordropdown(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.user.dropdown(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      users: data?.results || [],
      usersEmpty: !isLoading && !data?.results?.length,
      usersError: error,
      usersCount: data?.count || 0,
      usersLoading: isLoading,
      usersMutation: mutate,
      usersValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useSearchOrgs(query) {
  const request_body = { register: query };

  const queried_request_body = new URLSearchParams(request_body);

  const URL = endpoints.user.org(queried_request_body);

  const { data, isLoading, error, isValidating } = useSWR(
    query ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      users: data?.results || [],
      usersEmpty: !isLoading && !data?.results?.length,
      usersError: error,
      usersLoading: isLoading,
      usersValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

export function useGetRelatedUsers(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.user.related(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );

  const isListResponse = Array.isArray(data);

  const memoizedValue = useMemo(
    () => ({
      // pagination=false үед backend шууд list буцаана, бусад үед {results, count, ...}
      users: isListResponse ? data || [] : data?.results || [],
      usersEmpty:
        !isLoading &&
        (isListResponse
          ? !(data || []).length
          : !data?.results?.length),
      usersError: error,
      usersCount: isListResponse ? (data || []).length : data?.count || 0,
      usersLoading: isLoading,
      usersMutation: mutate,
      usersValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate, isListResponse]
  );
  return memoizedValue;
}
