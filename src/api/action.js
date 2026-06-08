import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

export function useGetActions(request_body) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.action.list(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, 'get'],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      actions: data?.results || [],
      actionsEmpty: !isLoading && !data?.results?.length,
      actionsError: error,
      actionsCount: data?.count || 0,
      actionsLoading: isLoading,
      actionsMutation: mutate,
      actionsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}
