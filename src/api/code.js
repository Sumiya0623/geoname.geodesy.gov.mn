import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

export function useGetCodes(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.code.list(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, 'get'],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      codes: data?.results || [],
      codesEmpty: !isLoading && !data?.results?.length,
      codesError: error,
      codesCount: data?.count || 0,
      codesLoading: isLoading,
      codesMutation: mutate,
      codesValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetCode(id) {
  const URL = endpoints.code.details(id);

  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, 'get'] : null,
    fetcher
  );

  const memoizedValue = useMemo(
    () => ({
      codeError: error,
      codeLoading: isLoading,
      code: data || {},
      codeValidating: isValidating,
      codeEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}
