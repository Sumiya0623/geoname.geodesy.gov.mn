"use client";

import { isEqual } from "lodash";
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import { Box, Collapse, Tooltip, IconButton } from "@mui/material";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useBoolean } from "src/hooks/use-boolean";
import { useGetConstantsFordropdown } from "src/api/constant";
import { useGetBaseMapLayers, useGetAvailableGsLayers } from "src/api/basemap";

import Iconify from "src/components/iconify";
import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";

import BaseMapTableRow from "../basemap-table-row";
import BaseMapNewEditForm from "../basemap-new-edit-form";
import BaseMapTableToolbar from "../basemap-table-toolbar";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  // Нэр + түлхүүр НЭГ баганад; түлхүүрийн байранд эрэмбэ (газрын зурагт
  // давхарлах дараалал — 1 нь хамгийн дээр)
  { id: "label", label: "Нэр" },
  { id: "sort_order", label: "Эрэмбэ", width: 90 },
  { id: "layer_type", label: "Төрөл", width: 110 },
  { id: "source_type", label: "Эх сурвалж", width: 110 },
  { id: "", label: "GeoServer / URL" },
  { id: "", label: "Харах эрх" },
  { id: "", label: "Идэвхтэй", width: 90, align: "center" },
  // Газрын зураг ачаалахад сонгогдох СУУРЬ давхарга — зөвхөн нэг байна
  { id: "", label: "Анхдагч", width: 90, align: "center" },
  { id: "", width: 60 },
];

const defaultFilters = { search: "", layer_type: "" };

// ----------------------------------------------------------------------

export default function BaseMapLayerListView() {
  const { enqueueSnackbar } = useSnackbar();
  const form = useBoolean();

  const table = useTable({
    defaultDense: true,
    defaultOrderBy: "sort_order",
    defaultOrder: "asc",
    defaultRowsPerPage: 25,
  });

  const [filters, setFilters] = useState(defaultFilters);

  const { available } = useGetAvailableGsLayers();
  // Роль жагсаалт — ROLES түлхүүртэй Constant‑ууд (ажилладаг dropdown hook)
  const { constants: roles = [] } = useGetConstantsFordropdown("ROLES");

  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.layer_type ? { layer_type: filters.layer_type } : {}),
    }),
    [filters, table.order, table.orderBy, table.page, table.rowsPerPage],
  );

  const { layers, layersCount, layersEmpty, layersLoading, layersMutation } =
    useGetBaseMapLayers(requestBody);

  // ── Чирж эрэмбэлэх ──────────────────────────────────────────────────
  // Жагсаалтыг локал хуулбар дээр шууд шилжүүлж (optimistic) харуулаад,
  // шинэ дарааллыг reorder‑оор нэг дор хадгална (эрэмбэ 1, 2, 3 …).
  const [rows, setRows] = useState([]);
  useEffect(() => setRows(layers || []), [layers]);

  // Зөвхөн эрэмбээр (өсөхөөр) эрэмбэлсэн үед чирэх нь утга учиртай
  const canDrag = table.orderBy === "sort_order" && table.order === "asc";
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = rows.findIndex((r) => r.id === active.id);
      const to = rows.findIndex((r) => r.id === over.id);
      if (from < 0 || to < 0) return;
      const next = arrayMove(rows, from, to);
      setRows(next);
      try {
        await axiosInstance.post(endpoints.basemap.reorder, {
          ids: next.map((r) => r.id),
        });
        layersMutation();
      } catch (error) {
        setRows(layers || []); // амжилтгүй бол буцаана
        enqueueSnackbar("Эрэмбэ хадгалахад алдаа гарлаа", {
          variant: "warning",
        });
      }
    },
    [rows, layers, layersMutation, enqueueSnackbar],
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

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        await axiosInstance.delete(endpoints.basemap.delete(id));
        enqueueSnackbar("Устгагдлаа");
        layersMutation();
      } catch (error) {
        enqueueSnackbar("Устгахад алдаа гарлаа", { variant: "warning" });
      }
    },
    [enqueueSnackbar, layersMutation],
  );

  const handleToggleEnabled = useCallback(
    async (row) => {
      try {
        await axiosInstance.patch(endpoints.basemap.edit(row.id), {
          is_enabled: !row.is_enabled,
        });
        layersMutation();
      } catch (error) {
        enqueueSnackbar("Төлөв солиход алдаа гарлаа", { variant: "warning" });
      }
    },
    [enqueueSnackbar, layersMutation],
  );

  // Анхдагчийг тэмдэглэх — backend нь бусад суурь давхаргынхыг автоматаар
  // цэвэрлэдэг (BaseMapLayer.save), тул зөвхөн PATCH хийхэд хангалттай.
  const handleSetDefault = useCallback(
    async (row) => {
      if (row.layer_type !== "base") {
        enqueueSnackbar("Зөвхөн суурь давхарга анхдагч байж болно", {
          variant: "info",
        });
        return;
      }
      try {
        await axiosInstance.patch(endpoints.basemap.edit(row.id), {
          is_default: !row.is_default,
        });
        layersMutation();
      } catch (error) {
        enqueueSnackbar("Анхдагчийг тохируулахад алдаа гарлаа", {
          variant: "warning",
        });
      }
    },
    [enqueueSnackbar, layersMutation],
  );

  const createAction = (
    <Tooltip title="Давхарга нэмэх">
      <IconButton color="primary" onClick={form.onToggle}>
        <Iconify icon="mingcute:add-line" />
      </IconButton>
    </Tooltip>
  );

  return (
    <Box>
      <Collapse in={form.value} timeout="auto" unmountOnExit>
        <Box sx={{ mb: 2 }}>
          <BaseMapNewEditForm
            onCloseForm={form.onFalse}
            refetch={layersMutation}
            roles={roles}
            available={available}
            layers={layers}
          />
        </Box>
      </Collapse>

      <Card>
        <BaseMapTableToolbar
          filters={filters}
          onFilters={handleFilters}
          canReset={canReset}
          onReset={handleResetFilters}
          action={createAction}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <TableContainer sx={{ position: "relative", overflow: "unset" }}>
            <Scrollbar>
              <Table
                size={table.dense ? "small" : "medium"}
                sx={{ minWidth: 960 }}
              >
                <TableHeadCustom
                  headLabel={TABLE_HEAD}
                  order={table.order}
                  orderBy={table.orderBy}
                  onSort={table.onSort}
                />
                <TableBody>
                  {layersLoading &&
                    Array.from({ length: table.rowsPerPage }).map((_, i) => (
                      <TableSkeleton key={i} headLength={TABLE_HEAD.length} />
                    ))}

                  {!layersLoading && (
                    <SortableContext
                      items={rows.map((r) => r.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {rows.map((row) => (
                        <BaseMapTableRow
                          key={row.id}
                          row={row}
                          refetch={layersMutation}
                          onDeleteRow={() => handleDeleteRow(row.id)}
                          onToggleEnabled={handleToggleEnabled}
                          onSetDefault={handleSetDefault}
                          roles={roles}
                          available={available}
                          layers={rows}
                          sortable={canDrag}
                        />
                      ))}
                    </SortableContext>
                  )}

                  <TableNoData notFound={layersEmpty && !layersLoading} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        </DndContext>

        <TablePaginationCustom
          count={layersCount}
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
