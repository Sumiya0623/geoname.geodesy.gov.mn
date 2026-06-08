import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

export function useGetUsers(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.user.list(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, 'get'],
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

export function useGetUser(id) {
  const URL = endpoints.user.details(id);

  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, 'get'] : null,
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

// ----------------------------------------------------------------------

export function useSearchUsers(query) {
  const request_body = { register: query };

  const queried_request_body = new URLSearchParams(request_body);

  const URL = endpoints.user.dropdown(queried_request_body);

  const { data, isLoading, error, isValidating } = useSWR(
    query ? [URL, axiosInstance, 'get'] : null,
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
