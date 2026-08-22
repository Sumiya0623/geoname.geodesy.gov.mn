"use client";

import useSWR from "swr";
import PropTypes from "prop-types";
import { useMemo } from "react";

import { Box, Tab, Tabs, Stack } from "@mui/material";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";

import Label from "src/components/label";

// ----------------------------------------------------------------------
// Тодруулалтын хүснэгтийн ДЭЭД мөр — төслийн талбайд багтах батлагдсан
// нэрсийн АНГИЛЛЫН тоо (Байгаль, Нийгэм … ) таб хэлбэрээр. Таб дарахад
// тухайн ангиллаар жагсаалт шүүгдэнэ (legal-table-status-тай ижил хэлбэр).
// ----------------------------------------------------------------------

export default function RecountTableStatus({
  params,
  value,
  onChange,
  action,
}) {
  // Тоо нь ЖАГСААЛТТАЙ ЯГ ИЖИЛ шүүлтээр (төсөл, үе шат, төлөв, хайлт …) ирнэ
  const query = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      // Ангиллын шүүлт болон хуудаслалт/эрэмбэ тооллогод хамаагүй
      if (["type", "page", "page_size", "ordering"].includes(k)) return;
      if (v === undefined || v === null || v === "") return;
      p.set(k, v);
    });
    return p.toString();
  }, [params]);

  const { data } = useSWR(
    query ? [endpoints.recount.typeSummary(query), axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false },
  );

  const groups = useMemo(() => data?.results || [], [data]);
  const total = data?.total || 0;

  if (!groups.length) return null;

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ px: 2, pt: 1 }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Tabs
          value={value ?? ""}
          onChange={(_e, v) => onChange?.(v === "" ? null : v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            value=""
            label="Нийт"
            iconPosition="end"
            icon={
              <Label variant={!value ? "filled" : "soft"} color="default">
                {total.toLocaleString()}
              </Label>
            }
            sx={{ "&:not(:last-of-type)": { mr: 3 } }}
          />
          {groups.map((g) => (
            <Tab
              key={g.id}
              value={g.id}
              label={g.name}
              iconPosition="end"
              icon={
                <Label
                  variant={value === g.id ? "filled" : "soft"}
                  color="primary"
                >
                  {(g.count || 0).toLocaleString()}
                </Label>
              }
              sx={{ "&:not(:last-of-type)": { mr: 3 } }}
            />
          ))}
        </Tabs>
      </Box>

      {/* Мөрийн АРД — үйлдлийн товч (ж: Газрын зураг) */}
      {action}
    </Stack>
  );
}

RecountTableStatus.propTypes = {
  params: PropTypes.object,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func,
  action: PropTypes.node,
};
