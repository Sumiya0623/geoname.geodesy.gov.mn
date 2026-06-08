"use client";

import { isEqual } from "lodash";
import { useState, useMemo, useCallback } from "react";

import {
  Box,
  Card,
  Grid,
  Table,
  Stack,
  Collapse,
  Container,
  Typography,
  TableBody,
  CardActionArea,
  CircularProgress,
  TableContainer,
} from "@mui/material";

import { paths } from "src/routes/paths";
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
import LegalNewEditForm from "../legal-new-edit-form";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 48 },
  { id: "name", label: "Нэр" },
  { id: "", label: "Нэгж" },
  { id: "order_date", label: "Огноо", width: 130 },
  { id: "order_number", label: "Дугаар" },
  { id: "", label: "Гарын үсэг", width: 150 },
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
        sx={{ mb: 3 }}
      />

      {/* Төрлийн картууд (label‑тай) */}
      {legalTypesLoading ? (
        <Box sx={{ py: 5, textAlign: "center" }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {legalTypes.map((type) => {
            const active = type.id === selectedId;
            return (
              <Grid key={type.id} item xs={12} sm={6} md={2}>
                <Card
                  sx={{
                    border: "2px solid",
                    borderColor: active ? "primary.main" : "transparent",
                    boxShadow: active
                      ? (t) => t.customShadows?.primary
                      : undefined,
                    transition: "all 0.2s ease",
                    height: 1,
                  }}
                >
                  <CardActionArea
                    onClick={() => handleSelect(type.id)}
                    sx={{ p: 2.5, height: 1 }}
                  >
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="subtitle2" sx={{ lineHeight: 1.3 }}>
                        {type.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {type.order_count} шийдвэр
                      </Typography>
                    </Box>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Сонгосон төрлийн тогтоолын хүснэгт */}
      {selectedType && (
        <Card>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ px: 2.5, pt: 2 }}
          >
            <Iconify icon="solar:folder-with-files-bold" width={22} />
            <Typography variant="h6">{selectedType.name}</Typography>
          </Stack>

          <LegalTableToolbar
            filters={filters}
            onFilters={handleFilters}
            canReset={canReset}
            onReset={handleResetFilters}
            canCreate={menuPermissions?.create}
            onCreate={form.onToggle}
            typeCode={String(selectedType?.code ?? "0")}
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
        </Card>
      )}
    </Container>
  );
}
