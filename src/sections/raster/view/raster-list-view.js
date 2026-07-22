"use client";

import { useState, useMemo, useCallback } from "react";

import {
  Box,
  Card,
  Table,
  Stack,
  Button,
  TableBody,
  Typography,
  TableContainer,
} from "@mui/material";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetRasters } from "src/api/raster";

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

import RasterPrintPanel from "../print-map-panel";
import RasterTableRow from "../raster-table-row";

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

export default function RasterListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({
    defaultDense: true,
    defaultOrderBy: "created_date",
    defaultOrder: "desc",
    defaultRowsPerPage: 10,
  });
  const [panelOpen, setPanelOpen] = useState(false);

  const requestBody = useMemo(
    () => ({ page: table.page + 1, page_size: table.rowsPerPage }),
    [table.page, table.rowsPerPage],
  );
  const {
    rasters,
    rastersCount,
    rastersLoading,
    rastersEmpty,
    rastersMutation,
  } = useGetRasters(requestBody);

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
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography variant="h5">
          Газар зүйн нэрийн зургийн хэвлэлийн эх
        </Typography>
        <Button
          variant="contained"
          startIcon={<Iconify icon="solar:printer-bold" />}
          onClick={() => setPanelOpen(true)}
        >
          Хэвлэх
        </Button>
      </Stack>

      <Card>
        <TableContainer sx={{ position: "relative", overflow: "unset" }}>
          <Scrollbar>
            <Table size="small" sx={{ minWidth: 900 }}>
              <TableHeadCustom headLabel={TABLE_HEAD} />
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
    </Box>
  );
}
