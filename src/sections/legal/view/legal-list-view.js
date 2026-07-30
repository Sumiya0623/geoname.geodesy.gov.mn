"use client";

import { isEqual } from "lodash";
import { useState, useMemo, useCallback } from "react";

import {
  Box,
  Card,
  Table,
  Button,
  Collapse,
  Container,
  Typography,
  TableBody,
  CircularProgress,
  TableContainer,
} from "@mui/material";

import { paths } from "src/routes/paths";
import { RouterLink } from "src/routes/components";
import { useBoolean } from "src/hooks/use-boolean";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetLegalTypes, useGetLegalOrders } from "src/api/legal";

import Iconify from "src/components/iconify";
import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";

import LegalTableRow from "../legal-table-row";
import LegalTableToolbar from "../legal-table-toolbar";
import LegalTableStatus from "../legal-table-status";
import LegalNewEditForm from "../legal-new-edit-form";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 48 },
  { id: "name", label: "Нэр" },
  { id: "unit", label: "Нэгж" },
  { id: "order_date", label: "Огноо", width: 130 },
  { id: "order_number", label: "Дугаар" },
  { id: "", label: "Баримт", width: 80, align: "center" },
  { id: "", width: 48 },
];

const defaultFilters = { search: "", year: "", aimag: null, sum: null };

// ----------------------------------------------------------------------

export default function LegalListView() {
  const { enqueueSnackbar } = useSnackbar();
  const menuPermissions = useMenuPermissions({ content: "legal" });
  const form = useBoolean();

  const table = useTable({
    defaultDense: true,
    defaultOrderBy: "order_date",
    defaultOrder: "desc",
    defaultRowsPerPage: 10,
  });

  const [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);

  // Төрлийн картууд
  const { legalTypes, legalTypesLoading, legalTypesMutation } =
    useGetLegalTypes();

  const selectedType = useMemo(
    () => legalTypes.find((t) => t.id === selectedId) || null,
    [legalTypes, selectedId],
  );

  // Сонгосон төрлийн тогтоолын хүснэгт
  const requestBody = useMemo(
    () =>
      selectedId
        ? {
            page: table.page + 1,
            page_size: table.rowsPerPage,
            ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
            org: selectedId,
            ...(filters.search ? { search: filters.search } : {}),
            ...(filters.year ? { year: filters.year } : {}),
            ...(filters.aimag?.id ? { aimag: filters.aimag.id } : {}),
            ...(filters.sum?.id ? { sum: filters.sum.id } : {}),
          }
        : null,
    [
      selectedId,
      table.page,
      table.rowsPerPage,
      table.order,
      table.orderBy,
      filters,
    ],
  );

  const {
    legalOrders,
    legalOrdersEmpty,
    legalOrdersCount,
    legalOrdersLoading,
    legalOrdersMutation,
  } = useGetLegalOrders(requestBody);

  const handleSelect = useCallback(
    (id) => {
      setSelectedId((prev) => (prev === id ? null : id));
      setFilters(defaultFilters);
      table.onResetPage();
      form.onFalse();
    },
    [table, form],
  );

  const handleFilters = useCallback(
    (name, value) => {
      table.onResetPage();
      setFilters((prev) => ({ ...prev, [name]: value }));
    },
    [table],
  );

  const handleResetFilters = useCallback(() => setFilters(defaultFilters), []);
  const canReset = !isEqual(defaultFilters, filters);

  const refetchAll = useCallback(() => {
    legalOrdersMutation();
    legalTypesMutation();
  }, [legalOrdersMutation, legalTypesMutation]);

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        const res = await axiosInstance.delete(endpoints.legal.delete(id));
        if (res?.status === 204) {
          enqueueSnackbar("Амжилттай устгагдлаа");
          refetchAll();
        }
      } catch (error) {
        const detail =
          error?.response?.data?.detail ||
          `Устгах үед алдаа гарлаа (код: ${error?.response?.status ?? "?"})`;
        enqueueSnackbar(detail, { variant: "warning" });
      }
    },
    [enqueueSnackbar, refetchAll],
  );

  const notFound = legalOrdersEmpty && !legalOrdersLoading;

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="Тогтоол, шийдвэрийн сан"
        links={[
          { name: "Дашбоард", href: paths.dashboard.root },
          { name: "Тогтоол, шийдвэрийн сан" },
        ]}
        action={
          <Button
            component={RouterLink}
            href={`${paths.dashboard.map.root}?overlay=legal`}
            variant="contained"
            color="primary"
            startIcon={<Iconify icon="solar:map-point-bold" />}
          >
            Газрын зураг
          </Button>
        }
        sx={{ mb: 3 }}
      />

      {/* Төрөл (toolbar‑ын дээр) + сонгосон төрлийн тогтоолын хүснэгт */}
      <Card>
        {legalTypesLoading ? (
          <Box sx={{ py: 3, textAlign: "center" }}>
            <CircularProgress size={22} />
          </Box>
        ) : (
          <LegalTableStatus
            types={legalTypes}
            value={selectedId}
            onChange={handleSelect}
          />
        )}

        {!selectedType ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Төрөл сонгоно уу.
            </Typography>
          </Box>
        ) : (
          <>
          <LegalTableToolbar
            filters={filters}
            onFilters={handleFilters}
            canReset={canReset}
            onReset={handleResetFilters}
            canCreate={menuPermissions?.create}
            onCreate={form.onToggle}
            typeCode={String(selectedType?.code ?? "0")}
            typeName={selectedType?.name || ""}
          />

          {/* Нэмэх форм — toolbar‑ийн доор нээгдэнэ */}
          <Collapse in={form.value} timeout="auto" unmountOnExit>
            <Box sx={{ px: 2.5, pb: 2 }}>
              <LegalNewEditForm
                selectedType={selectedType}
                onClose={form.onFalse}
                refetch={refetchAll}
              />
            </Box>
          </Collapse>

          <TableContainer sx={{ position: "relative", overflow: "unset" }}>
            <Scrollbar>
              <Table
                size={table.dense ? "small" : "medium"}
                sx={{ minWidth: 900 }}
              >
                <TableHeadCustom
                  headLabel={TABLE_HEAD}
                  order={table.order}
                  orderBy={table.orderBy}
                  onSort={table.onSort}
                />
                <TableBody>
                  {legalOrdersLoading
                    ? Array.from({ length: table.rowsPerPage }).map((_, i) => (
                        <TableSkeleton key={i} headLength={TABLE_HEAD.length} />
                      ))
                    : legalOrders.map((row, index) => (
                        <LegalTableRow
                          key={row.id}
                          row={row}
                          index={index}
                          page={table.page}
                          rowsPerPage={table.rowsPerPage}
                          colSpan={TABLE_HEAD.length}
                          menuPermissions={menuPermissions}
                          refetch={refetchAll}
                          onDeleteRow={() => handleDeleteRow(row.id)}
                        />
                      ))}

                  <TableNoData notFound={notFound} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>

          <TablePaginationCustom
            count={legalOrdersCount}
            page={table.page}
            onPageChange={table.onChangePage}
            rowsPerPage={table.rowsPerPage}
            onRowsPerPageChange={table.onChangeRowsPerPage}
            dense={table.dense}
            onChangeDense={table.onChangeDense}
          />
          </>
        )}
      </Card>
    </Container>
  );
}
