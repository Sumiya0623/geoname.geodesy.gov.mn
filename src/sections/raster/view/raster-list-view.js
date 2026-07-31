"use client";

import PropTypes from "prop-types";

import { isEqual } from "lodash";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";

import {
  Card,
  Container,
  Table,
  TableBody,
  TableContainer,
} from "@mui/material";

import axiosInstance, { endpoints } from "src/utils/axios";
import { paths } from "src/routes/paths";
import { useDebounce } from "src/hooks/use-debounce";
import { useSettingsContext } from "src/components/settings";
import { useGetRasters } from "src/api/raster";

import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";

import CustomBreadcrumbs from "src/components/custom-breadcrumbs";

import RasterPrintPanel from "../print-map-panel";
import RasterTableToolbar from "../raster-table-toolbar";
import RasterTableRow from "../raster-table-row";

const defaultFilters = { search: "", aimag: null, sum: null, year: "" };

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 48 },
  { id: "year", label: "Он", width: 70 },
  { id: "title", label: "Зургийн нэр" },
  { id: "name_count", label: "Нэрийн тоо", align: "center" },
  { id: "is_border", label: "Хилийн цэс", align: "center" },
  { id: "scale", label: "Масштаб", width: 110 },
  { id: "user_name", label: "Хэвлэсэн", width: 150 },
  { id: "", label: "PDF", width: 90, align: "center" },
  { id: "", width: 48 },
];

export default function RasterListView({ embedded = false, onCount }) {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({
    defaultDense: true,
    defaultOrderBy: "created_date",
    defaultOrder: "desc",
    defaultRowsPerPage: 10,
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const dq = useDebounce(filters.search, 400);

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
      ...(dq ? { search: dq } : {}),
      ...(filters.sum?.id
        ? { unit: filters.sum.id }
        : filters.aimag?.id
          ? { unit: filters.aimag.id }
          : {}),
      ...(filters.year ? { year: filters.year } : {}),
    }),
    [
      table.page,
      table.rowsPerPage,
      table.order,
      table.orderBy,
      dq,
      filters.aimag,
      filters.sum,
      filters.year,
    ],
  );
  const {
    rasters,
    rastersCount,
    rastersLoading,
    rastersEmpty,
    rastersMutation,
  } = useGetRasters(requestBody);

  // Нийт тоог эцэг хуудсанд мэдэгдэнэ (collapse‑ийн толгойд харуулна)
  const onCountRef = useRef(onCount);
  onCountRef.current = onCount;
  useEffect(() => {
    onCountRef.current?.(rastersCount);
  }, [rastersCount]);

  const handleDelete = useCallback(
    async (id) => {
      try {
        await axiosInstance.delete(endpoints.raster.delete(id));
        enqueueSnackbar("Устгагдлаа");
        rastersMutation();
      } catch (e) {
        enqueueSnackbar("Устгахад алдаа", { variant: "warning" });
      }
    },
    [enqueueSnackbar, rastersMutation],
  );

  const notFound = rastersEmpty && !rastersLoading;

  return (
    <Container
      maxWidth={embedded ? false : settings.themeStretch ? false : "xxl"}
      disableGutters={embedded}
    >
      {!embedded && (
        <CustomBreadcrumbs
          heading="Газар зүйн нэрийн зургийн хэвлэлийн эх"
          links={[
            { name: "Дашбоард", href: paths.dashboard.root },
            { name: "Хэвлэлийн эх" },
          ]}
          sx={{ mb: 3 }}
        />
      )}

      <Card sx={embedded ? { boxShadow: "none" } : undefined}>
        <RasterTableToolbar
          filters={filters}
          onFilters={handleFilters}
          canReset={canReset}
          onReset={handleResetFilters}
          onPrint={() => setPanelOpen(true)}
        />

        <TableContainer sx={{ position: "relative", overflow: "unset" }}>
          <Scrollbar>
            <Table size="small" sx={{ minWidth: 900 }}>
              <TableHeadCustom
                headLabel={TABLE_HEAD}
                order={table.order}
                onSort={table.onSort}
                orderBy={table.orderBy}
              />
              <TableBody>
                {rastersLoading
                  ? Array.from({ length: table.rowsPerPage }).map((_, i) => (
                      <TableSkeleton key={i} headLength={TABLE_HEAD.length} />
                    ))
                  : rasters.map((row, i) => (
                      <RasterTableRow
                        key={row.id}
                        row={row}
                        page={table.page}
                        rowsPerPage={table.rowsPerPage}
                        index={i}
                        onDelete={handleDelete}
                      />
                    ))}
                <TableNoData notFound={notFound} />
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
          dense={table.dense}
          onChangeDense={table.onChangeDense}
        />
      </Card>

      <RasterPrintPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onDone={rastersMutation}
      />
    </Container>
  );
}

RasterListView.propTypes = {
  embedded: PropTypes.bool,
  onCount: PropTypes.func,
};
