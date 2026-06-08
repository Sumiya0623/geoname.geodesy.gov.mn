import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/utils/axios';

export function useGetReports(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.report.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, 'get'],
    fetcher,
    { shouldRetryOnError: false }
  );
  const memoizedValue = useMemo(
    () => ({
      Reports: data?.results || [],
      ReportsEmpty: !isLoading && !data?.results?.length,
      ReportsError: error,
      ReportsCount: data?.count || 0,
      ReportsLoading: isLoading,
      ReportsMutation: mutate,
      ReportsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------
