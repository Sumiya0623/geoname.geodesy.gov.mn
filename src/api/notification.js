import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

export function useGetNotifications(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.notification.list(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(() => {
    const allNotifications = data?.flatMap((page) => page.results) || [];
    const unreadCount = data?.[0]?.unread_count || 0;
    const totalCount = data?.[0]?.count || 0;
    const hasMore = !!data?.[data.length - 1]?.next;

    const meta = {
      count: totalCount,
      unread_count: unreadCount,
      read_count: totalCount - unreadCount,
    };

    return {
      notifications: allNotifications,
      notificationsCount: meta.count,
      notificationsUnReadCount: meta.unread_count,
      notificationsReadCount: meta.read_count,
      notificationsEmpty: !isValidating && allNotifications.length === 0,
      notificationsError: error,
      meta,
      notificationsLoading: !data && !error,
      notificationsValidating: isValidating,
      notificationsMutation: mutate,
      loadMore: () => setSize((prev) => prev + 1),
      hasMore,
    };
  }, [data, error, isValidating, mutate]);

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetNotification(id) {
  const URL = endpoints.notification.details(id);

  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher
  );

  const memoizedValue = useMemo(
    () => ({
      notification: data || {},
      notificationEmpty: !isLoading && !Object.keys(data || {}).length,
      notificationError: error,
      notificationLoading: isLoading,
      notificationValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useInfiniteNotifications(initialParams = {}) {
  const PAGE_SIZE = 20;

  const getKey = (pageIndex, previousPageData) => {
    if (previousPageData && !previousPageData.next) return null;

    const params = new URLSearchParams({
      ...initialParams,
      page: pageIndex + 1,
      page_size: PAGE_SIZE,
    }).toString();

    return [endpoints.notification.list(params), axiosInstance, "get"];
  };

  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite(
    getKey,
    fetcher,
    {
      revalidateFirstPage: false,
      shouldRetryOnError: false,
    }
  );

  const allNotifications = data?.flatMap((page) => page.results) || []; // eslint-disable-line react-hooks/exhaustive-deps
  const unreadCount = data?.[0]?.unread_count || 0;
  const totalCount = data?.[0]?.count || 0;
  const hasMore = !!data?.[data.length - 1]?.next;

  const memoizedValue = useMemo(
    () => {
      const meta = {
        count: totalCount,
        unread_count: unreadCount,
        read_count: totalCount - unreadCount,
      };

      return {
        notifications: allNotifications,
        notificationsCount: meta.count,
        notificationsUnReadCount: meta.unread_count,
        notificationsReadCount: meta.read_count,
        notificationsEmpty: !isValidating && allNotifications.length === 0,
        notificationsError: error,
        meta,
        notificationsLoading: !data && !error,
        notificationsValidating: isValidating,
        notificationsMutation: mutate,
        loadMore: () => setSize((prev) => prev + 1),
        hasMore,
      };
    },
    [data, error, isValidating, mutate, setSize, allNotifications, unreadCount, totalCount, hasMore]
  );

  return memoizedValue;
}
