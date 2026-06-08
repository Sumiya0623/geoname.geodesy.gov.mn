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
import { Icon } from "@iconify/react";

import { paths } from "src/routes/paths";
import { useBoolean } from "src/hooks/use-boolean";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetRequests, useGetRequestStatuses } from "src/api/request";

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

import RequestTableRow from "../request-table-row";
import RequestTableToolbar from "../request-table-toolbar";
import RequestNewForm from "../request-new-form";
import RequestChangeForm from "../request-change-form";

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

export default function RequestListView() {
  const { enqueueSnackbar } = useSnackbar();
  const menuPermissions = useMenuPermissions({ content: "request" });
  const form = useBoolean();

  const table = useTable({
    defaultDense: true,
    defaultOrderBy: "created_date",
    defaultOrder: "desc",
    defaultRowsPerPage: 10,
  });

  const [selectedId, setSelectedId] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);

  const { statuses, statusesLoading, statusesMutation } =
    useGetRequestStatuses();

  const selectedStatus = useMemo(
    () => statuses.find((s) => String(s.id) === String(selectedId)) || null,
    [statuses, selectedId],
  );
  const isSpecificStatus = !!selectedStatus && selectedStatus.id !== "";

  const requestBody = useMemo(
    () =>
      selectedId !== null
        ? {
            page: table.page + 1,
            page_size: table.rowsPerPage,
            ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
            ...(isSpecificStatus ? { status: selectedStatus.id } : {}),
            ...(filters.search ? { search: filters.search } : {}),
          }
        : null,
    [
      selectedId,
      isSpecificStatus,
      selectedStatus,
      table.page,
      table.rowsPerPage,
      table.order,
      table.orderBy,
      filters,
    ],
  );

  const {
    requests,
    requestsEmpty,
    requestsCount,
    requestsLoading,
    requestsMutation,
  } = useGetRequests(requestBody);

  const refetchAll = useCallback(() => {
    requestsMutation();
    statusesMutation();
  }, [requestsMutation, statusesMutation]);

  const handleSelect = useCallback(
    (id) => {
      setSelectedId((prev) => (String(prev) === String(id) ? null : id));
      setFilters(defaultFilters);
      table.onResetPage();
    },
    [table],
  );

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
          refetchAll();
        }
      } catch (error) {
        enqueueSnackbar(
          error?.response?.data?.detail || "Устгах үед алдаа гарлаа",
          {
            variant: "warning",
          },
        );
      }
    },
    [enqueueSnackbar, refetchAll],
  );

  const openCreate = () => {
    setEditItem(null);
    form.onTrue();
  };
  const openEdit = (item) => {
    setEditItem(item);
    form.onTrue();
  };

  const notFound = requestsEmpty && !requestsLoading;

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="Иргэний хүсэлт"
        links={[
          { name: "Дашбоард", href: paths.dashboard.root },
          { name: "Иргэний хүсэлт" },
        ]}
        sx={{ mb: 3 }}
      />

      {/* Төлөвийн картууд */}
      {statusesLoading ? (
        <Box sx={{ py: 5, textAlign: "center" }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {statuses.map((st) => {
            const active = String(st.id) === String(selectedId);
            return (
              <Grid key={st.id || "all"} item xs={12} sm={6} md={4} lg={3}>
                <Card
                  sx={{
                    border: "2px solid",
                    borderColor: active ? "primary.main" : "transparent",
                    transition: "all 0.2s ease",
                  }}
                >
                  <CardActionArea
                    onClick={() => handleSelect(st.id)}
                    sx={{ p: 2.5 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          minWidth: 48,
                          borderRadius: 1.5,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "common.white",
                          bgcolor: `${st.color || "primary"}.main`,
                        }}
                      >
                        <Icon icon="solar:document-add-bold" width={26} />
                      </Box>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="subtitle1" noWrap>
                          {st.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {st.count} хүсэлт
                        </Typography>
                      </Box>
                    </Stack>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Хүснэгт */}
      {selectedId !== null && (
        <Card>
          <RequestTableToolbar
            filters={filters}
            onFilters={handleFilters}
            canReset={canReset}
            onReset={() => setFilters(defaultFilters)}
            canCreate={isSpecificStatus && menuPermissions?.create}
            onCreate={openCreate}
          />

          {/* Хүсэлтийн форм — toolbar‑ийн доор нээгдэнэ (Dialog биш) */}
          <Collapse in={form.value} timeout="auto" unmountOnExit>
            <Box sx={{ px: 2.5, pb: 2 }}>
              {(() => {
                const st =
                  editItem?.status ||
                  (isSpecificStatus ? selectedStatus : null);
                const isChange = (st?.name || "").includes("Өөрчл");
                const FormComp = isChange ? RequestChangeForm : RequestNewForm;
                return (
                  <FormComp
                    onClose={form.onFalse}
                    currentItem={editItem}
                    selectedStatus={
                      isSpecificStatus ? selectedStatus : editItem?.status
                    }
                    refetch={refetchAll}
                  />
                );
              })()}
            </Box>
          </Collapse>

          <TableContainer sx={{ position: "relative", overflow: "unset" }}>
            <Scrollbar>
              <Table
                size={table.dense ? "small" : "medium"}
                sx={{ minWidth: 800 }}
              >
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
                          onEdit={() => openEdit(row)}
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
      )}
    </Container>
  );
}
