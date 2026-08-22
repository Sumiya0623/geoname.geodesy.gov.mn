"use client";

import { isEqual } from "lodash";
import { useState, useMemo, useCallback } from "react";

import { Card, Table, TableBody, TableContainer } from "@mui/material";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetRequests } from "src/api/request";
import { useAuthContext } from "src/auth/hooks";

import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";

import RequestTableRow from "src/sections/dashboard/request/request-table-row";
import RequestTableToolbar from "src/sections/dashboard/request/request-table-toolbar";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 48 },
  { id: "", width: 48 },
  { id: "", label: "Нэр" },
  { id: "", label: "Төрөл", width: 160 },
  { id: "", label: "Маягт", width: 120, align: "center" },
  { id: "created_date", label: "Огноо", width: 130 },
  { id: "", width: 48 },
];

const defaultFilters = { search: "" };

// ----------------------------------------------------------------------

export default function ProfileRequests() {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const table = useTable({
    defaultDense: true,
    defaultOrderBy: "created_date",
    defaultOrder: "desc",
    defaultRowsPerPage: 10,
  });

  const [filters, setFilters] = useState(defaultFilters);

  const requestBody = useMemo(
    () =>
      user?.id
        ? {
            user_id: user.id,
            page: table.page + 1,
            page_size: table.rowsPerPage,
            ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
            ...(filters.search ? { search: filters.search } : {}),
          }
        : null,
    [user?.id, table.page, table.rowsPerPage, table.order, table.orderBy, filters],
  );

  const {
    requests,
    requestsEmpty,
    requestsCount,
    requestsLoading,
    requestsMutation,
  } = useGetRequests(requestBody);

  const handleFilters = useCallback(
    (name, value) => {
      table.onResetPage();
      setFilters((prev) => ({ ...prev, [name]: value }));
    },
    [table],
  );

  const canReset = !isEqual(defaultFilters, filters);

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        const res = await axiosInstance.delete(endpoints.request.delete(id));
        if (res?.status === 204) {
          enqueueSnackbar("Амжилттай устгагдлаа");
          requestsMutation();
        }
      } catch (error) {
        enqueueSnackbar(
          error?.response?.data?.detail || "Устгах үед алдаа гарлаа",
          { variant: "warning" },
        );
      }
    },
    [enqueueSnackbar, requestsMutation],
  );

  // Профайл дээр зөвхөн харах + өөрийн хүсэлтээ устгах боломжтой
  const menuPermissions = { update: false, delete: true, create: false };

  const notFound = requestsEmpty && !requestsLoading;

  return (
    <Card>
      <RequestTableToolbar
        filters={filters}
        onFilters={handleFilters}
        canReset={canReset}
        onReset={() => setFilters(defaultFilters)}
        canCreate={false}
      />

      <TableContainer sx={{ position: "relative", overflow: "unset" }}>
        <Scrollbar>
          <Table size={table.dense ? "small" : "medium"} sx={{ minWidth: 800 }}>
            <TableHeadCustom
              headLabel={TABLE_HEAD}
              order={table.order}
              orderBy={table.orderBy}
              onSort={table.onSort}
            />
            <TableBody>
              {requestsLoading
                ? Array.from({ length: table.rowsPerPage }).map((_, i) => (
                    <TableSkeleton key={i} headLength={TABLE_HEAD.length} />
                  ))
                : requests.map((row, index) => (
                    <RequestTableRow
                      key={row.id}
                      row={row}
                      index={index}
                      page={table.page}
                      rowsPerPage={table.rowsPerPage}
                      colSpan={TABLE_HEAD.length}
                      menuPermissions={menuPermissions}
                      onEdit={() => {}}
                      onDeleteRow={() => handleDeleteRow(row.id)}
                    />
                  ))}
              <TableNoData notFound={notFound} />
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      <TablePaginationCustom
        count={requestsCount}
        page={table.page}
        onPageChange={table.onChangePage}
        rowsPerPage={table.rowsPerPage}
        onRowsPerPageChange={table.onChangeRowsPerPage}
        dense={table.dense}
        onChangeDense={table.onChangeDense}
      />
    </Card>
  );
}
