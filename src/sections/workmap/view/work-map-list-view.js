"use client";

import PropTypes from "prop-types";
import { isEqual } from "lodash";
import { useRef, useMemo, useState, useEffect, useCallback } from "react";

import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetRasters } from "src/api/raster";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";

import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";

import WorkMapDialog from "../work-map-dialog";
import WorkMapTableRow from "../work-map-table-row";
import WorkMapTableToolbar from "../work-map-table-toolbar";

// ----------------------------------------------------------------------
// АЖЛЫН ЗУРГИЙН ЖАГСААЛТ (PrintMap, төсөлтэй) — бие даасан list‑view.
//   • toolbar дээрх «+»‑ээр шинэ A0 зураг үүсгэнэ
//   • мөрийн 3 цэгийн цэсээр нээх / устгах
// Бүтэц нь бусад жагсаалттай (constant‑list‑view) ижил: useTable +
// TableHeadCustom + TablePaginationCustom + мөр/toolbar тусдаа компонент.
// Эрх: SUBMENUS code='workmap' (Ажлын зураг удирдах эрх).
// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 48 },
  { id: "title", label: "Нэр" },
  { id: "", label: "Нэгж", width: 190 },
  { id: "name_count", label: "Нэр", width: 100, align: "center" },
  { id: "scale", label: "Масштаб", width: 110 },
  { id: "created_date", label: "Үүсгэсэн", width: 230 },
  { id: "", width: 48 },
];

const defaultFilters = { search: "" };

export default function WorkMapListView({ projectId, onCount }) {
  const { enqueueSnackbar } = useSnackbar();
  const [open, setOpen] = useState(true); // «Ажлын зураг» хэсгийг задлах/хаах
  const [openDialog, setOpenDialog] = useState(false); // зураг үүсгэх цонх
  const [reloadKey, setReloadKey] = useState(0); // жагсаалтыг дахин татах түлхүүр

  const menuPermissions = useMenuPermissions({ content: "workmap" });
  const table = useTable({
    defaultDense: true,
    defaultOrder: "desc",
    defaultOrderBy: "created_date",
    defaultRowsPerPage: 5,
  });

  const [filters, setFilters] = useState(defaultFilters);

  const handleFilters = useCallback(
    (name, value) => {
      table.onResetPage();
      setFilters((prev) => ({ ...prev, [name]: value }));
    },
    [table],
  );
  const handleResetFilters = useCallback(() => setFilters(defaultFilters), []);
  const canReset = !isEqual(defaultFilters, filters);

  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      project: projectId,
      ...(filters.search ? { search: filters.search } : {}),
      // Шинэ зураг үүсэх бүрд дахин татна
      _r: reloadKey || 0,
    }),
    [
      projectId,
      reloadKey,
      filters,
      table.order,
      table.orderBy,
      table.page,
      table.rowsPerPage,
    ],
  );

  const {
    rasters,
    rastersEmpty,
    rastersCount,
    rastersLoading,
    rastersMutation,
  } = useGetRasters(requestBody);

  // Нийт тоог эцэг хуудсанд мэдэгдэнэ (collapse‑ийн толгойд харуулна)
  const onCountRef = useRef(onCount);
  onCountRef.current = onCount;
  useEffect(() => {
    onCountRef.current?.(rastersCount);
  }, [rastersCount]);

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        const res = await axiosInstance.delete(endpoints.raster.delete(id));
        if (res?.status === 204) {
          enqueueSnackbar("Устгагдлаа");
          rastersMutation();
        }
      } catch (error) {
        enqueueSnackbar(
          error?.response?.data?.detail || "Устгахад алдаа гарлаа",
          { variant: "warning" },
        );
      }
    },
    [enqueueSnackbar, rastersMutation],
  );

  // Харах эрхгүй бол бүхэл таб хоосон
  if (!projectId || !menuPermissions?.list) return null;

  return (
    <>
      <WorkMapTableToolbar
        filters={filters}
        onFilters={handleFilters}
        canReset={canReset}
        onReset={handleResetFilters}
        canCreate={!!menuPermissions?.create}
        onCreate={() => setOpenDialog(true)}
      />

      <TableContainer sx={{ position: "relative", overflow: "unset" }}>
        <Scrollbar>
          <Table size={table.dense ? "small" : "medium"} sx={{ minWidth: 960 }}>
            <TableHeadCustom
              headLabel={TABLE_HEAD}
              order={table.order}
              orderBy={table.orderBy}
              onSort={table.onSort}
            />

            <TableBody>
              {rastersLoading &&
                Array.from({ length: table.rowsPerPage }).map((_, i) => (
                  <TableSkeleton key={i} headLength={TABLE_HEAD.length} />
                ))}

              {!rastersLoading &&
                rasters.map((row, index) => (
                  <WorkMapTableRow
                    key={row.id}
                    row={row}
                    rowQueue={{
                      rowsPerPage: table.rowsPerPage,
                      page: table.page,
                      index,
                    }}
                    menuPermissions={menuPermissions}
                    onDeleteRow={() => handleDeleteRow(row.id)}
                  />
                ))}

              <TableNoData notFound={rastersEmpty} />
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      <TablePaginationCustom
        count={rastersCount}
        page={table.page}
        onPageChange={table.onChangePage}
        rowsPerPage={table.rowsPerPage}
        onRowsPerPageChange={table.onChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25]}
        dense={table.dense}
        onChangeDense={table.onChangeDense}
      />
      {/* Шинэ ажлын зураг (A0 PDF) үүсгэх цонх */}
      <WorkMapDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onDone={() => setReloadKey((k) => k + 1)}
        projectId={projectId}
      />
    </>
  );
}

WorkMapListView.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onCount: PropTypes.func,
};
