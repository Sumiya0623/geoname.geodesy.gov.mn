import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

export function useGetProjects(request_body = {}) {
  const queried_request_body = new URLSearchParams(request_body).toString();
  const URL = endpoints.project.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    [URL, axiosInstance, 'get'],
    fetcher,
    { shouldRetryOnError: false }
  );
  const memoizedValue = useMemo(
    () => ({
      projects: data?.results || [],
      projectsEmpty: !isLoading && !data?.results?.length,
      projectsError: error,
      projectsCount: data?.count || 0,
      projectsLoading: isLoading,
      projectsMutation: mutate,
      projectsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetProject(id) {
  const URL = endpoints.project.details(id);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    id ? [URL, axiosInstance, 'get'] : null,
    fetcher
  );
  const memoizedValue = useMemo(
    () => ({
      project: data || {},
      projectEmpty: !isLoading && !Object.keys(data || {}).length,
      projectError: error,
      projectLoading: isLoading,
      projectValidating: isValidating,
      projectMutation: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

export function useGetTasks(projectId, filters) {

  if(filters) {
    // Яваандаа эд бүгд хэрэг болж магадгүй гэж үзээд одоохондоо ингэж орхисон байгаа шүү.
    // Битгий устгаарай
    filters.page = filters.page + 1;
    delete filters['order'];
    filters['page_size'] = filters.rowsPerPage;
    delete filters['rowsPerPage'];
    delete filters['orderBy']
    delete filters['dense']
  }
    
  const request_body = {
    job: projectId,
    ...filters
  };

  const queried_request_body = new URLSearchParams(request_body);

  const URL = endpoints.project.task.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    projectId ? [URL, axiosInstance, 'get'] : null,
    fetcher
  );
  return useMemo(
    () => ({
      tasks: data?.results || [],
      tasksEmpty: !isLoading && (!data || data.length === 0),
      tasksLoading: isLoading,
      tasksError: error,
      tasksCount: data?.count || 0,
      tasksValidating: isValidating,
      tasksMutation: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

export function useGetTasksForDropDown(projectId, filters) {

  const request_body = {
    job: projectId,
    pagination:false
  };

  const queried_request_body = new URLSearchParams(request_body);

  const URL = endpoints.project.task.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    projectId ? [URL, axiosInstance, 'get'] : null,
    fetcher
  );
  return useMemo(
    () => ({
      tasks: data?.results || [],
      tasksEmpty: !isLoading && (!data || data.length === 0),
      tasksLoading: isLoading,
      tasksError: error,
      tasksCount: data?.count || 0,
      tasksValidating: isValidating,
      tasksMutation: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

export function useGetTaskImplements(taskId) {
  const request_body = { task: taskId };
  const queried_request_body = new URLSearchParams(request_body);
  const URL = endpoints.project.task.implement.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    taskId ? [URL, axiosInstance, 'get'] : null,
    fetcher
  );
  return useMemo(
    () => ({
      taskimplements: data?.results || [],
      taskimplementsEmpty: !isLoading && (!data || data.length === 0),
      taskimplementsLoading: isLoading,
      taskimplementsError: error,
      taskimplementsCount: data?.count || 0,
      taskimplementsValidating: isValidating,
      taskimplementsMutation: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

export function useGetProjectImplements(projectId) {
  const request_body = { project_id: projectId };
  const queried_request_body = new URLSearchParams(request_body);
  const URL = endpoints.project.task.implement.list(queried_request_body);
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    projectId ? [URL, axiosInstance, 'get'] : null,
    fetcher
  );
  return useMemo(
    () => ({
      projectImplements: data?.results || [],
      projectImplementsEmpty: !isLoading && (!data || data.length === 0),
      projectImplementsLoading: isLoading,
      projectImplementsError: error,
      projectImplementsCount: data?.count || 0,
      projectImplementsValidating: isValidating,
      projectImplementsMutation: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

export function useSearchProjects(query = '') {
  const request_body = { register: query };
  const queryString = new URLSearchParams(request_body).toString();
  const URL = endpoints.project.dropdown(queryString);

  const { data, isLoading, error, isValidating } = useSWR(
    [URL, axiosInstance, 'get'],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      projects: data?.results || [],
      projectsEmpty: !isLoading && !data?.results?.length,
      projectsError: error,
      projectsCount: data?.count || 0,
      projectsLoading: isLoading,
      projectsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetProjectForCount(query = '') {
  const request_body = { register: query };
  const queryString = new URLSearchParams(request_body).toString();
  const URL = endpoints.project.count(queryString);

  const { data, isLoading, error, isValidating } = useSWR(
    [URL, axiosInstance, 'get'],
    fetcher,
    { shouldRetryOnError: false }
  );

  const memoizedValue = useMemo(
    () => ({
      projects: data?.results || [],
      projectsEmpty: !isLoading && !data?.results?.length,
      projectsError: error,
      projectsCount: data?.count || 0,
      projectsLoading: isLoading,
      projectsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------


export function useGetProjectInfo() {
  const URL = endpoints.project.info();

  const { data, isLoading, error, isValidating } = useSWR([URL, axiosInstance, 'get'], fetcher, {
    shouldRetryOnError: false,
  });

  const memoizedValue = useMemo(
    () => ({
      project: data || {},
      projectEmpty: !isLoading && !Object.keys(data || {}).length,
      projectError: error,
      projectLoading: isLoading,
      projectValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}
