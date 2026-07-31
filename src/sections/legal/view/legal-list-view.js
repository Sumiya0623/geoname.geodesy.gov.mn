"use client";

import PropTypes from "prop-types";
import { isEqual } from "lodash";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";

import {
  Box,
  Card,
  Chip,
  Table,
  Stack,
  Button,
  Tooltip,
  Collapse,
  Typography,
  TableBody,
  TableContainer,
} from "@mui/material";

import { paths } from "src/routes/paths";
import { RouterLink } from "src/routes/components";
import { useBoolean } from "src/hooks/use-boolean";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetLegalOrders, useGetLegalTypes } from "src/api/legal";
import { useGetChampaign } from "src/api/champaign";

import Iconify from "src/components/iconify";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
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
// Бэлтгэл ажил — тухайн төслийн (projectId) тогтоол/шийдвэр (LegalOrder). Дахин
// ашиглаж болохоор projectId prop‑оор авна (default ""). Тухайн төслийн detail‑ээс
// төрлүүдийг (types = LEGAL_TYPES) татаж жижиг chip болгож харуулна; chip сонгоход
// тэр төрлөөр нарийсгана. Нэмэхэд LegalOrder‑г төсөлд (projectId) холбож хадгална.
// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 48 },
  { id: "name", label: "Нэр" },
  { id: "", label: "Нэгж" },
  { id: "order_date", label: "Огноо" },
  { id: "order_number", label: "Дугаар" },

  { id: "", label: "Баримт", align: "center" },
  { id: "" },
];

const defaultFilters = { search: "", year: "", aimag: null, sum: null };

export default function LegalListView({
  projectId = "",
  embedded = false,
  onCount,
}) {
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

  // Нийт тоог эцэг хуудсанд мэдэгдэнэ (collapse‑ийн толгойд харуулна)
  const onCountRef = useRef(onCount);
  onCountRef.current = onCount;
  useEffect(() => {
    onCountRef.current?.(legalOrdersCount);
  }, [legalOrdersCount]);

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

  // embedded — төслийн хуудасны collapse дотор (гадна Card давхардуулахгүй)
  const Wrapper = embedded ? Box : Card;

  return (
    <Box>
      {/* Толгой — ЗӨВХӨН бие даасан хуудсанд (/dashboard/legal).
          Төслийн дотор (embedded) collapse‑ийн гарчиг байдаг тул нуугдана. */}
      {!embedded && (
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
      )}

      {/* Бүх нэг карт дотор: толгойд табууд (chip), toolbar‑д хайлт + Нэмэх */}
      <Wrapper sx={embedded ? { boxShadow: "none" } : undefined}>
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
          {/* Мөрийн АРД — сангаас бөөнөөр холбох (зөвхөн төслийн дотор) */}
          {!!projectId && !!menuPermissions?.create && (
            <Tooltip title="Сангаас холбох — төслийн хамрах засаг захиргаанд (аймаг сонгосон бол доод шатны сум, баг хүртэл) харьяалагдах бүх шийдвэрийг нэг дор төсөлд холбоно">
              <span style={{ marginLeft: "auto" }}>
                <Button
                  variant="outlined"
                  color="primary"
                  disabled={syncing}
                  startIcon={
                    <Iconify
                      icon="solar:refresh-circle-bold"
                      sx={
                        syncing
                          ? {
                              animation: "spin 1s linear infinite",
                              "@keyframes spin": {
                                from: { transform: "rotate(0deg)" },
                                to: { transform: "rotate(360deg)" },
                              },
                            }
                          : undefined
                      }
                    />
                  }
                  onClick={handleSyncFromBank}
                  sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  Сангаас холбох
                </Button>
              </span>
            </Tooltip>
          )}
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
        />

        {/* Нэмэх форм — toolbar доор шууд задарна.
            Хүрээ/дэвсгэрийг ФОРМ ӨӨРӨӨ өгдөг тул энд давхар хүрээ өгөхгүй. */}
        <Collapse in={addPanel.value} timeout="auto" unmountOnExit>
          <Box sx={{ mx: 2.5, mb: 2 }}>
            <LegalNewEditForm
              projectId={projectId}
              selectedType={selectedType}
              onClose={addPanel.onFalse}
              refetch={refreshAll}
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
      </Wrapper>
    </Box>
  );
}

LegalListView.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  embedded: PropTypes.bool,
  onCount: PropTypes.func,
};
