import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

export function useGetSubmenus(request_body) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.submenu.list(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, 'get'],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      submenus: data?.results || [],
      submenusEmpty: !isLoading && !data?.results?.length,
      submenusError: error,
      submenusCount: data?.count || 0,
      submenusLoading: isLoading,
      submenusMutation: mutate,
      submenusValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}
