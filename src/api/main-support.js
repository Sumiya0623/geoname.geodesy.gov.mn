import useSWR from "swr";
import { useMemo } from "react";

import {
  mainApi,
  mainFetcher,
  mainEndpoints,
  MAIN_SYSTEM_ID,
} from "src/utils/main-axios";

// ----------------------------------------------------------------------
// Төв систем дэх гарын авлага, түгээмэл асуулт, тусламжийн хүсэлт.
// Бүх өгөгдөл төв системд хадгалагдана — энд юу ч хадгалахгүй.
// ----------------------------------------------------------------------

const swrOptions = { shouldRetryOnError: false };

const toQuery = (params = {}) =>
  new URLSearchParams(
    Object.entries(params).filter(
      ([, v]) => v !== "" && v !== null && v !== undefined,
    ),
  ).toString();

// --- Гарын авлага (зөвхөн энэ системийнх) -------------------------------

export function useMainGuides(request_body = {}) {
  const URL = mainEndpoints.post.list(
    toQuery({
      label_in: "MANUALS",
      parents_in: MAIN_SYSTEM_ID,
      ...request_body,
    }),
  );

  const { data, isLoading, error, mutate } = useSWR([URL], mainFetcher, swrOptions);

  return useMemo(
    () => ({
      guides: data?.results || [],
      guidesEmpty: !isLoading && !data?.results?.length,
      guidesError: error,
      guidesCount: data?.count || 0,
      guidesTotalPages: data?.total_pages || 1,
      guidesLoading: isLoading,
      guidesMutation: mutate,
    }),
    [data, error, isLoading, mutate],
  );
}

// --- Түгээмэл асуулт ----------------------------------------------------

export function useMainFaqs(request_body = {}) {
  const URL = mainEndpoints.post.list(
    toQuery({
      label_in: "FAQS",
      parents_in: MAIN_SYSTEM_ID,
      ...request_body,
    }),
  );

  const { data, isLoading, error, mutate } = useSWR([URL], mainFetcher, swrOptions);

  return useMemo(
    () => ({
      faqs: data?.results || [],
      faqsEmpty: !isLoading && !data?.results?.length,
      faqsTotalPages: data?.total_pages || 1,
      faqsLoading: isLoading,
      faqsMutation: mutate,
    }),
    [data, error, isLoading, mutate],
  );
}

// --- Тусламжийн хүсэлт --------------------------------------------------

export function useGetTickets(request_body = {}, enabled = true) {
  const URL = mainEndpoints.ticket.list(toQuery(request_body));

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    enabled ? [URL] : null,
    mainFetcher,
    swrOptions,
  );

  return useMemo(
    () => ({
      tickets: data?.results || [],
      ticketsEmpty: !isLoading && !data?.results?.length,
      ticketsError: error,
      ticketsCount: data?.count || 0,
      ticketsTotalPages: data?.total_pages || 1,
      ticketsLoading: isLoading,
      ticketsValidating: isValidating,
      ticketsMutation: mutate,
    }),
    [data, error, isLoading, isValidating, mutate],
  );
}

export function useGetTicket(id, token) {
  const params = token ? toQuery({ token }) : "";
  const URL = id ? mainEndpoints.ticket.details(id, params) : null;

  const { data, isLoading, error, isValidating, mutate } = useSWR(
    URL ? [URL] : null,
    mainFetcher,
    swrOptions,
  );

  return useMemo(
    () => ({
      ticket: data || null,
      ticketError: error,
      ticketLoading: isLoading,
      ticketValidating: isValidating,
      ticketMutation: mutate,
    }),
    [data, error, isLoading, isValidating, mutate],
  );
}

export function useGetTicketStats(request_body = {}, enabled = true) {
  const URL = mainEndpoints.ticket.stats(toQuery(request_body));

  const { data, isLoading, error, mutate } = useSWR(
    enabled ? [URL] : null,
    mainFetcher,
    swrOptions,
  );

  return useMemo(
    () => ({
      stats: data || null,
      statsLoading: isLoading,
      statsError: error,
      statsMutation: mutate,
    }),
    [data, error, isLoading, mutate],
  );
}

// --- Үйлдлүүд -----------------------------------------------------------

/** Хүсэлт үүсгэх. Систем нь автоматаар энэ систем болно. */
export async function createTicket(values, files = []) {
  const payload = { ...values, system: values.system || MAIN_SYSTEM_ID };

  if (files?.length) {
    const form = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        form.append(key, value);
      }
    });
    files.forEach((file) => form.append("files", file));
    const res = await mainApi.post(mainEndpoints.ticket.create, form);
    return res.data;
  }

  const res = await mainApi.post(mainEndpoints.ticket.create, payload);
  return res.data;
}

/** Хүсэлтэд нэмж бичих. asStaff=true үед хариуцагчийн хариу болно. */
export async function replyTicket(id, body, files = [], asStaff = false) {
  if (files?.length) {
    const form = new FormData();
    form.append("body", body);
    if (asStaff) form.append("as_staff", "true");
    files.forEach((file) => form.append("files", file));
    const res = await mainApi.post(mainEndpoints.ticket.reply(id), form);
    return res.data;
  }
  const res = await mainApi.post(mainEndpoints.ticket.reply(id), {
    body,
    ...(asStaff && { as_staff: true }),
  });
  return res.data;
}

export async function rateTicket(id, value, comment, token) {
  const res = await mainApi.post(mainEndpoints.ticket.rate(id), {
    value,
    comment,
    token,
  });
  return res.data;
}

// --- Тогтмолууд (төв системийнхтэй ижил) --------------------------------

export const TICKET_STATUS = {
  new: { label: "Шинэ", color: "info" },
  answered: { label: "Хариулсан", color: "primary" },
  pending: { label: "Хүлээгдэж буй", color: "warning" },
  closed: { label: "Хаасан", color: "default" },
};

export const TICKET_PRIORITY = {
  low: { label: "Бага", color: "default" },
  normal: { label: "Энгийн", color: "info" },
  high: { label: "Яаралтай", color: "error" },
};

export const TICKET_RATING = [
  {
    value: 3,
    label: "Сайн, Сэтгэл ханамжтай байна.",
    color: "#22C55E",
    icon: "😊",
  },
  { value: 2, label: "Мэдэхгүй байна.", color: "#EAB308", icon: "😐" },
  {
    value: 1,
    label: "Муу, Сэтгэл ханамжгүй байна.",
    color: "#EF4444",
    icon: "🙁",
  },
];
