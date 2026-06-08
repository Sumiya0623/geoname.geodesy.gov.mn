import PropTypes from "prop-types";
import { useCallback, useMemo } from "react";
import useSWR from "swr";

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import { formHelperTextClasses } from "@mui/material/FormHelperText";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import { Box, Tab, Tabs, Divider } from "@mui/material";

import Iconify from "src/components/iconify";
import Label from "src/components/label";
import { useGetStatuses } from "src/api/constant";
import axiosInstance, { endpoints, fetcher } from "src/utils/axios";
import { formatMNT } from "src/utils/format-number";

import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers";

// ----------------------------------------------------------------------

export default function OrderTableToolbar({
  filters,
  onFilters,
  dateError,
  onReset,
  canReset,
}) {
  const { statuses } = useGetStatuses("PAYMENT_STATUS");

  // Нийт дүнг тооцоолох — status-аас бусад шүүлтээр шүүгдсэн orders-ийг татаад
  // status-оор бүлэглэнэ.
  const sumQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("pagination", "false");
    if (filters?.name_or_register)
      params.set("name_or_register", filters.name_or_register);
    if (filters?.created_date)
      params.set("created_date", filters.created_date);
    if (filters?.end_date) params.set("end_date", filters.end_date);
    return params.toString();
  }, [filters?.name_or_register, filters?.created_date, filters?.end_date]);

  const allOrdersUrl = endpoints.order.list(sumQueryParams);
  const { data: allOrdersData } = useSWR(
    [allOrdersUrl, axiosInstance, "get"],
    fetcher,
    { shouldRetryOnError: false }
  );

  const statsByStatus = useMemo(() => {
    const sum = {};
    const count = {};
    let totalSum = 0;
    let totalCount = 0;
    const list = Array.isArray(allOrdersData)
      ? allOrdersData
      : allOrdersData?.results || [];
    list.forEach((o) => {
      const sid = o?.status?.id ?? o?.status;
      const val = Number(o?.subtotal) || 0;
      if (sid != null) {
        sum[sid] = (sum[sid] || 0) + val;
        count[sid] = (count[sid] || 0) + 1;
      }
      totalSum += val;
      totalCount += 1;
    });
    return { sum, count, totalSum, totalCount };
  }, [allOrdersData]);

  const handleStatusChange = useCallback(
    (_, newValue) => {
      onFilters("status", newValue ?? null);
    },
    [onFilters]
  );

  return (
    <>
      <Tabs
        value={filters?.status ?? ""}
        onChange={handleStatusChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          px: 2.5,
          boxShadow: (theme) =>
            `inset 0 -2px 0 0 ${theme.palette.divider}`,
        }}
      >
        {statuses.map((tab) => {
          const isAll = tab.id == null || tab.id === "";
          const sum = isAll
            ? statsByStatus.totalSum
            : statsByStatus.sum[tab.id] || 0;
          const count = isAll
            ? statsByStatus.totalCount
            : statsByStatus.count[tab.id] ?? tab.count ?? 0;
          return (
            <Tab
              key={tab.id ?? "all"}
              value={tab.id ?? ""}
              iconPosition="end"
              label={tab.name}
              icon={
                <Label
                  variant={
                    (filters?.status ?? "") === (tab.id ?? "")
                      ? "filled"
                      : "soft"
                  }
                  color={tab.color || "default"}
                >
                  {`${count} (${formatMNT(Math.round(sum))})`}
                </Label>
              }
              sx={{ "&:not(:last-of-type)": { mr: 3 } }}
            />
          );
        })}
      </Tabs>
      <Divider />

      <Stack
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        direction={{ xs: "column", md: "row" }}
        sx={{ p: 2.5, pr: { xs: 2.5, md: 1 } }}
      >
        <TextField
          fullWidth
          size="small"
          value={filters.name_or_register ?? ""}
          onChange={(e) => onFilters("name_or_register", e.target.value)}
          placeholder="Хэрэглэгчийн нэр болон регистер..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify
                  icon="eva:search-fill"
                  sx={{ color: "text.disabled" }}
                />
              </InputAdornment>
            ),
          }}
        />

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="Эхлэх огноо"
            value={filters.created_date ?? null}
            onChange={(v) =>
              onFilters(
                "created_date",
                v?.isValid?.() ? v.format("YYYY-MM-DD") : ""
              )
            }
            format="YYYY-MM-DD"
            slotProps={{
              textField: { size: "small", sx: { minWidth: 180, flex: 1 } },
            }}
          />
        </LocalizationProvider>

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="Дуусах огноо"
            value={filters.end_date ?? null}
            onChange={(v) =>
              onFilters(
                "end_date",
                v?.isValid?.() ? v.format("YYYY-MM-DD") : ""
              )
            }
            format="YYYY-MM-DD"
            slotProps={{
              textField: {
                size: "small",
                error: dateError,
                helperText: dateError && "Эхлэх огнооноос их",
                sx: {
                  minWidth: 180,
                  flex: 1,
                  [`& .${formHelperTextClasses.root}`]: {
                    position: { md: "absolute" },
                    bottom: { md: -22 },
                  },
                },
              },
            }}
          />
        </LocalizationProvider>

        <Tooltip title="Шүүлт цэвэрлэх">
          <Box>
            <IconButton onClick={onReset} disabled={!canReset}>
              <Badge color="error" variant="dot" invisible={!canReset}>
                <Iconify icon="solar:restart-bold" />
              </Badge>
            </IconButton>
          </Box>
        </Tooltip>
      </Stack>
    </>
  );
}

OrderTableToolbar.propTypes = {
  dateError: PropTypes.bool,
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  onReset: PropTypes.func,
  canReset: PropTypes.bool,
};
