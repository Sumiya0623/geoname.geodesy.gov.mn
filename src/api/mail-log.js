import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------
// Системээс илгээсэн имэйлүүдийн админ хяналт (/dashboard/notification)
// ----------------------------------------------------------------------

export function useGetMailLogs(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.maillog.list(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, 'get'],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      mailLogs: data?.results || [],
      mailLogsEmpty: !isLoading && !data?.results?.length,
      mailLogsError: error,
      mailLogsCount: data?.count || 0,
      mailLogsLoading: isLoading,
      mailLogsMutation: mutate,
      mailLogsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetMailLogStatus() {
  const URL = endpoints.maillog.status('');

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, 'get'],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      statuses: data?.results || [],
      statusesLoading: isLoading,
      statusesError: error,
      statusesValidating: isValidating,
      statusesMutation: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}
