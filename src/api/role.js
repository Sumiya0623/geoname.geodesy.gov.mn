import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

export function useGetRoles(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.role.list(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, 'get'],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      rolesError: error,
      rolesLoading: isLoading,
      roles: data?.results || [],
      rolesValidating: isValidating,
      rolesMutation: mutate,
      rolesEmpty: !isLoading && !data?.results?.length,
      rolesCount: data?.count || 0,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetRole(id) {
  const URL = endpoints.role.details(id);

  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, 'get'] : null,
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
