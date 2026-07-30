"use client";

import PropTypes from "prop-types";
import { isEqual } from "lodash";
import { useState, useMemo, useCallback } from "react";

import {
  Box,
  Card,
  Chip,
  Table,
  Stack,
  Collapse,
  Typography,
  TableBody,
  TableContainer,
} from "@mui/material";

import { useBoolean } from "src/hooks/use-boolean";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetLegalOrders, useGetLegalTypes } from "src/api/legal";
import { useGetChampaign } from "src/api/champaign";

import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";

import LegalTableRow from "src/sections/legal/legal-table-row";
import LegalTableToolbar from "src/sections/legal/legal-table-toolbar";

import BeltgelAdd from "../beltgel-add";

// ----------------------------------------------------------------------
// Бэлтгэл ажил — тухайн төслийн (projectId) тогтоол/шийдвэр (LegalOrder). Дахин
// ашиглаж болохоор projectId prop‑оор авна (default ""). Тухайн төслийн detail‑ээс
// төрлүүдийг (types = LEGAL_TYPES) татаж жижиг chip болгож харуулна; chip сонгоход
// тэр төрлөөр нарийсгана. Нэмэхэд LegalOrder‑г төсөлд (projectId) холбож хадгална.
// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 48 },
  { id: "name", label: "Нэр" },
  { id: "", label: "Нэгж" },
  { id: "order_date", label: "Огноо", width: 130 },
  { id: "order_number", label: "Дугаар" },
  { id: "", label: "Гарын үсэг" },
  { id: "", label: "Баримт", width: 80, align: "center" },
  { id: "", width: 48 },
];

const defaultFilters = { search: "", year: "", aimag: null, sum: null };

export default function BeltgelListView({ projectId = "" }) {
  const { enqueueSnackbar } = useSnackbar();
  const menuPermissions = useMenuPermissions({ content: "legal" });
  const addPanel = useBoolean();

  // Chip‑ийн төрлүүд:
  //  - projectId БАЙВАЛ → тухайн төсөлд бүртгэгдсэн төрлүүд (registered_types).
  //  - projectId БАЙХГҮЙ (ж: /dashboard/legal) → бүх LEGAL_TYPES (ерөнхий сан).
  const { champaign, champaignMutation } = useGetChampaign(projectId);
  const { legalTypes, legalTypesMutation } = useGetLegalTypes();
  const types = useMemo(
    () => (projectId ? champaign?.registered_types || [] : legalTypes),
    [projectId, champaign?.registered_types, legalTypes],
  );

  const table = useTable({
    defaultDense: true,
    defaultOrderBy: "order_date",
    defaultOrder: "desc",
    defaultRowsPerPage: 10,
  });

  const [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);

  const selectedType = useMemo(
    () => types.find((t) => t.id === selectedId) || null,
    [types, selectedId],
  );

  // Ордын хүснэгт. projectId байвал тухайн төслөөр (projects) нарийсгана; үгүй бол
  // бүх орд. Төрөл (chip) сонгосон бол org‑оор нарийсгана.
  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      ...(projectId ? { projects: projectId } : {}),
      ...(selectedId ? { org: selectedId } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.year ? { year: filters.year } : {}),
      ...(filters.aimag?.id ? { aimag: filters.aimag.id } : {}),
      ...(filters.sum?.id ? { sum: filters.sum.id } : {}),
    }),
    [
      selectedId,
      projectId,
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
      addPanel.onFalse();
    },
    [table, addPanel],
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

  // Жагсаалт + chip‑ийн төрлүүдийг хамт шинэчилнэ (project эсвэл ерөнхий горим)
  const refreshAll = useCallback(() => {
    legalOrdersMutation();
    if (projectId) {
      if (champaignMutation) champaignMutation();
    } else if (legalTypesMutation) {
      legalTypesMutation();
    }
  }, [legalOrdersMutation, projectId, champaignMutation, legalTypesMutation]);

  // "Сангаас дуудах" — төслийн хамрах ЗЗ нэгжид харьяалагдах бүх шийдвэрийг
  // (аймаг сонгосон бол доод шатны сум/баг хүртэл) нэг дор төсөлд холбоно.
  const [syncing, setSyncing] = useState(false);
  const handleSyncFromBank = useCallback(async () => {
    if (!projectId || syncing) return;
    setSyncing(true);
    try {
      const res = await axiosInstance.post(endpoints.legal.attachByUnits, {
        project: projectId,
      });
      const { added = 0, skipped = 0 } = res?.data || {};
      enqueueSnackbar(
        added
          ? `${added} шийдвэр сангаас холбогдлоо${skipped ? ` (${skipped} нь өмнө холбогдсон)` : ""}`
          : "Шинээр холбох шийдвэр олдсонгүй",
        { variant: added ? "success" : "info" },
      );
      refreshAll();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Сангаас дуудахад алдаа гарлаа",
        { variant: "warning" },
      );
    } finally {
      setSyncing(false);
    }
  }, [projectId, syncing, enqueueSnackbar, refreshAll]);

  // Мөр хасах:
  //  - projectId БАЙВАЛ → тухайн төслөөс САЛГАНА (detach). Орд санд үлдэнэ.
  //  - projectId БАЙХГҮЙ (ерөнхий) → ордыг бүрэн УСТГАНА.
  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        if (projectId) {
          const res = await axiosInstance.post(
            endpoints.legal.detachProject(id),
            { project: projectId },
          );
          if (res?.status === 200) {
            enqueueSnackbar("Баримт бичгийг төслөөс хаслаа");
            refreshAll();
          }
        } else {
          const res = await axiosInstance.delete(endpoints.legal.delete(id));
          if (res?.status === 204) {
            enqueueSnackbar("Баримт бичгийг амжилттай устгалаа");
            refreshAll();
          }
        }
      } catch (error) {
        const detail =
          error?.response?.data?.detail ||
          `Үйлдэл хийх үед алдаа гарлаа (код: ${error?.response?.status ?? "?"})`;
        enqueueSnackbar(detail, { variant: "warning" });
      }
    },
    [enqueueSnackbar, projectId, refreshAll],
  );

  const notFound = legalOrdersEmpty && !legalOrdersLoading;

  return (
    <Box>
      {/* Бүх нэг карт дотор: толгойд табууд (chip), toolbar‑д хайлт + Нэмэх */}
      <Card>
        {/* Толгой — табууд (chip) гарчигны оронд */}
        <Stack
          direction="row"
          flexWrap="wrap"
          gap={1}
          alignItems="center"
          sx={{ px: 2.5, pt: 2 }}
        >
          <Chip
            label="Бүгд"
            color={selectedId === null ? "primary" : "default"}
            variant={selectedId === null ? "filled" : "outlined"}
            onClick={() => handleSelect(null)}
          />
          {types.length === 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ alignSelf: "center" }}
            >
              Төрөл алга.
            </Typography>
          )}
          {types.map((type) => {
            const active = type.id === selectedId;
            return (
              <Chip
                key={type.id}
                label={
                  type.order_count
                    ? `${type.label} · ${type.order_count}`
                    : type.label
                }
                color={active ? "primary" : "default"}
                variant={active ? "filled" : "outlined"}
                onClick={() => handleSelect(type.id)}
              />
            );
          })}
        </Stack>

        {/* Toolbar — хайлт/шүүлт + Нэмэх */}
        <LegalTableToolbar
          filters={filters}
          onFilters={handleFilters}
          canReset={canReset}
          onReset={handleResetFilters}
          canCreate={menuPermissions?.create}
          onCreate={addPanel.onToggle}
          typeCode={String(selectedType?.code ?? "0")}
          canSync={!!projectId && !!menuPermissions?.create}
          onSync={handleSyncFromBank}
          syncing={syncing}
        />

        {/* Нэмэх панел — toolbar доор */}
        <Collapse in={addPanel.value} timeout="auto" unmountOnExit>
          <Box sx={{ px: 2.5, pb: 1 }}>
            <BeltgelAdd
              projectId={projectId}
              onDone={refreshAll}
              onClose={addPanel.onFalse}
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
                        refetch={refreshAll}
                        onDeleteRow={() => handleDeleteRow(row.id)}
                        detachMode={!!projectId}
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
    </Box>
  );
}

BeltgelListView.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
