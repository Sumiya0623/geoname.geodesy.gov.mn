import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------

export function useGetMaps(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();

  const URL = endpoints.geoserver.list(queried_request_body);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false },
  );

  const memoizedValue = useMemo(
    () => ({
      maps: data?.results || [],
      mapsEmpty: !isLoading && !data?.results?.length,
      mapsError: error,
      mapsCount: data?.count || 0,
      mapsLoading: isLoading,
      mapsMutation: mutate,
      mapsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate],
  );

  return memoizedValue;
}

export function useGetMap(id) {
  const URL = endpoints.geoserver.details(id);
  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher,
  );
  const memoizedValue = useMemo(
    () => ({
      map: data || {},
      mapError: error,
      mapLoading: isLoading,
      map: data || {},
      mapValidating: isValidating,
      mapEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating],
  );

  return memoizedValue;
}

export function useGetMapsFordropdown(query) {
  const queried_request_body = new URLSearchParams(query).toString();
  const URL = endpoints.geoserver.dropdown(queried_request_body);
  const key = query ? [URL, axiosInstance, "get"] : null;
  const { data, isLoading, error, isValidating } = useSWR(key, fetcher);
  const memoizedValue = useMemo(
    () => ({
      maps: data?.results || [],
      mapsEmpty: !isLoading && !data?.results?.length,
      mapsError: error,
      mapsLoading: isLoading,
      mapsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating],
  );

  return memoizedValue;
}

export async function fetchMapsByNameId(nameId, extraParams = {}) {
  if (!nameId) return [];
  const params = new URLSearchParams({
    pagination: "false",
    names: String(nameId),
    ...extraParams,
  }).toString();
  const url = endpoints.geoserver.list(params);
  const res = await axiosInstance.get(url);
  return res?.data?.results || [];
}

export function useGetLayers(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.geoserver.layer.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false },
  );
  const memoizedValue = useMemo(
    () => ({
      layers: data?.results || [],
      layersEmpty: !isLoading && !data?.results?.length,
      layersError: error,
      layersCount: data?.count || 0,
      layersLoading: isLoading,
      layersMutation: mutate,
      layersValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate],
  );
  return memoizedValue;
}

export function useGetLayer(id) {
  const URL = endpoints.geoserver.layer.details(id);
  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher,
  );
  const memoizedValue = useMemo(
    () => ({
      layer: data || {},
      layerError: error,
      layerLoading: isLoading,
      layer: data || {},
      layerValidating: isValidating,
      layerEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating],
  );

  return memoizedValue;
}

export function useGetAttributes(request_body = {}) {
  const layerId = request_body?.layerId;
  const shouldFetch = Boolean(layerId);

  // зөвхөн defined/хоосон биш утгуудыг params-д хийе
  const params = new URLSearchParams();
  if (shouldFetch) {
    Object.entries(request_body).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "")
        params.append(k, String(v));
    });
  }
  const URL = shouldFetch
    ? endpoints.geoserver.layer.attributes(params.toString())
    : null;
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    URL ? [URL, axiosInstance, "get"] : null, // ← layerId байхгүй үед fetch хийхгүй
    fetcher,
    { shouldRetryOnError: false },
  );
  return useMemo(
    () => ({
      attributes: data?.results || [],
      attributesEmpty: !isLoading && !data?.results?.length,
      attributesError: error,
      attributesCount: data?.count || 0,
      attributesLoading: isLoading,
      attributesMutation: mutate,
      attributesValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate],
  );
}

export function useGetStyleFields(request_body = {}) {
  const layerId = request_body?.layerId;
  const shouldFetch = Boolean(layerId);

  // зөвхөн defined/хоосон биш утгуудыг params-д хийе
  const params = new URLSearchParams();
  if (shouldFetch) {
    Object.entries(request_body).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "")
        params.append(k, String(v));
    });
  }
  const URL = shouldFetch
    ? endpoints.geoserver.layer.stylefields(params.toString())
    : null;
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    URL ? [URL, axiosInstance, "get"] : null, // ← layerId байхгүй үед fetch хийхгүй
    fetcher,
    { shouldRetryOnError: false },
  );
  return useMemo(
    () => ({
      fields: data?.results || [],
      fieldsEmpty: !isLoading && !data?.results?.length,
      fieldsError: error,
      fieldsCount: data?.count || 0,
      fieldsLoading: isLoading,
      fieldsMutation: mutate,
      fieldsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate],
  );
}

export function useGetStyles(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.geoserver.style.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false },
  );
  const memoizedValue = useMemo(
    () => ({
      styles: data?.results || [],
      stylesEmpty: !isLoading && !data?.results?.length,
      stylesError: error,
      stylesCount: data?.count || 0,
      stylesLoading: isLoading,
      stylesMutation: mutate,
      stylesValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate],
  );
  return memoizedValue;
}

export function useGetStyle(id) {
  const URL = endpoints.geoserver.style.details(id);
  const { data, isLoading, error, isValidating } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher,
  );
  const memoizedValue = useMemo(
    () => ({
      style: data || {},
      styleError: error,
      styleLoading: isLoading,
      style: data || {},
      styleValidating: isValidating,
      styleEmpty: !isLoading && !error && !Object.keys(data || {}).length,
    }),
    [data, error, isLoading, isValidating],
  );
  return memoizedValue;
}

export function useGetGeoserver(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.geoserver.geoserver(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false },
  );
  const memoizedValue = useMemo(
    () => ({
      geoserver: data?.results || [],
      geoserverEmpty: !isLoading && !data?.results?.length,
      geoserverError: error,
      geoserverCount: data?.count || 0,
      geoserverLoading: isLoading,
      geoserverMutation: mutate,
      geoserverValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate],
  );
  return memoizedValue;
}

export function useGetBaseLayers(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.geoserver.layer.baseLayers;
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false },
  );
  const memoizedValue = useMemo(
    () => ({
      baseLayers: data?.results || [],
      baseLayersEmpty: !isLoading && !data?.results?.length,
      baseLayersError: error,
      baseLayersCount: data?.count || 0,
      baseLayersLoading: isLoading,
      baseLayersMutation: mutate,
      baseLayersValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate],
  );
  return memoizedValue;
}
