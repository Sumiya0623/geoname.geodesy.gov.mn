"use client";

import { useState, useMemo, useCallback } from "react";

import {
  Box,
  Card,
  Chip,
  Table,
  Stack,
  Button,
  Tooltip,
  TableRow,
  TableCell,
  TableBody,
  Typography,
  IconButton,
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

const TABLE_HEAD = [
  { id: "year", label: "Он", width: 70 },
  { id: "title", label: "Зургийн нэр" },
  { id: "name_count", label: "Нэрийн тоо", width: 100, align: "center" },
  { id: "is_border", label: "Хилийн цэс", width: 100, align: "center" },
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
  const { rasters, rastersCount, rastersLoading, rastersEmpty, rastersMutation } =
    useGetRasters(requestBody);

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
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">Газар зүйн нэрийн зургийн хэвлэлийн эх</Typography>
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
                  : rasters.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{row.year || "—"}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {row.title || row.units_text || "—"}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">{row.name_count}</TableCell>
                        <TableCell align="center">
                          {row.is_border ? (
                            <Chip size="small" color="warning" label="Тийм" />
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {row.scale ? `1 : ${Number(row.scale).toLocaleString()}` : "—"}
                        </TableCell>
                        <TableCell>{row.user_name || "—"}</TableCell>
                        <TableCell align="center">
                          {row.file_url ? (
                            <Tooltip title="PDF татах">
                              <IconButton
                                color="error"
                                component="a"
                                href={row.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Iconify icon="mdi:file-pdf-box" width={24} />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Устгах">
                            <IconButton color="default" onClick={() => handleDelete(row.id)}>
                              <Iconify icon="solar:trash-bin-trash-bold" width={20} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
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
