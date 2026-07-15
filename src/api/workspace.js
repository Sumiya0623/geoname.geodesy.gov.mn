import useSWR from "swr";
import { useMemo } from "react";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
// GeoServer workspace (WORKSPACES) ангиллын мод — parent байхгүй бол үндсэн
// workspace‑ууд (картууд), parent‑аар дэд зангилаа (child_count‑той).
// ----------------------------------------------------------------------

export function useGetWorkspaceTree(request_body = null) {
  const query = request_body
    ? new URLSearchParams(request_body).toString()
    : "";
  const URL = endpoints.workspace.tree(query);

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    request_body ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  return useMemo(
    () => ({
      workspaces: data?.results || [],
      workspacesEmpty: !isLoading && !data?.results?.length,
      workspacesError: error,
      workspacesCount: data?.count ?? data?.results?.length ?? 0,
      workspacesLoading: isLoading,
      workspacesMutation: mutate,
      workspacesValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

// ----------------------------------------------------------------------
// GeoServer дээрх workspace‑ийн төлөв: байгаа эсэх + WMS/WFS/WMTS идэвх.
// ----------------------------------------------------------------------

export function useGetWorkspaceGsStatus(id) {
  const URL = id ? endpoints.workspace.gsStatus(id) : null;
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );

  return useMemo(
    () => ({
      gsStatus: data || null,
      gsServices: data?.services || {},
      gsExists: !!data?.exists,
      gsLoading: isLoading,
      gsError: error,
      gsMutation: mutate,
      gsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

// ----------------------------------------------------------------------
// geoname/wms доторх type‑view‑ууд (нэр, геометр, level1/2/3)
// ----------------------------------------------------------------------

export function useGetWorkspaceTypeViews(id) {
  const URL = id ? endpoints.workspace.typeViews(id) : null;
  const { data, isLoading, error, mutate } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );
  return useMemo(
    () => ({
      views: data?.results || [],
      viewsStore: data?.store || "wms",
      viewsLoading: isLoading,
      viewsError: error,
      viewsMutation: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// ----------------------------------------------------------------------
// Workspace доторх store‑ууд (GeoServer datastore)
// ----------------------------------------------------------------------

export function useGetWorkspaceStores(id) {
  const URL = id ? endpoints.workspace.gsStores(id) : null;
  const { data, isLoading, error, mutate } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );
  return useMemo(
    () => ({
      stores: data?.results || [],
      storesLoading: isLoading,
      storesError: error,
      storesMutation: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// ----------------------------------------------------------------------
// Workspace доторх БҮХ нийтэлсэн layer (vector/raster/wms/wmts) — store болон
// төрлийн шошготой. geoname‑ээс бусад workspace‑уудын layer жагсаахад.
// ----------------------------------------------------------------------

export function useGetWorkspaceLayers(id) {
  const URL = id ? endpoints.workspace.gsAllLayers(id) : null;
  const { data, isLoading, error, mutate } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );
  return useMemo(
    () => ({
      layers: data?.results || [],
      workspaceName: data?.workspace || "",
      layersLoading: isLoading,
      layersError: error,
      layersMutation: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// ----------------------------------------------------------------------
// Workspace доторх GeoServer layer group‑ууд (нэрс)
// ----------------------------------------------------------------------

export function useGetWorkspaceLayergroups(id) {
  const URL = id ? endpoints.workspace.gsLayergroups(id) : null;
  const { data, isLoading, error, mutate } = useSWR(
    id ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );
  return useMemo(
    () => ({
      groups: data?.results || [],
      groupsLoading: isLoading,
      groupsError: error,
      groupsMutation: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// Нэг layer group‑ийн дэлгэрэнгүй (эрэмбэлэгдсэн layer жагсаалт)
export function useGetWorkspaceLayergroup(id, name) {
  const URL = id && name ? endpoints.workspace.gsLayergroup(id, name) : null;
  const { data, isLoading, error, mutate } = useSWR(
    URL ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );
  return useMemo(
    () => ({
      group: data || null,
      groupLoading: isLoading,
      groupError: error,
      groupMutation: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// ----------------------------------------------------------------------
// Store доторх layer‑ууд (PG view‑д суурилсан featuretype)
// ----------------------------------------------------------------------

export function useGetStoreLayers(id, store) {
  const URL =
    id && store
      ? endpoints.workspace.gsLayers(
          id,
          new URLSearchParams({ store }).toString()
        )
      : null;
  const { data, isLoading, error, mutate } = useSWR(
    URL ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false }
  );
  return useMemo(
    () => ({
      layers: data?.results || [],
      layersLoading: isLoading,
      layersError: error,
      layersMutation: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}
