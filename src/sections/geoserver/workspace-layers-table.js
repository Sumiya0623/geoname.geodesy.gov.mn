import PropTypes from "prop-types";
import { useMemo, useState, useCallback } from "react";

import {
  Box,
  Card,
  Chip,
  Table,
  Button,
  Divider,
  MenuItem,
  TableRow,
  TextField,
  TableBody,
  TableCell,
  IconButton,
  Typography,
  InputAdornment,
  TableContainer,
} from "@mui/material";

import { useBoolean } from "src/hooks/use-boolean";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetWorkspaceLayers } from "src/api/workspace";

import Iconify from "src/components/iconify";
import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";

import WorkspaceCreateViewForm from "./workspace-create-view-form";

// ----------------------------------------------------------------------
// geoname‑ээс бусад workspace (raster, basemap, ...)‑ийн GeoServer layer‑ийг
// энгийн жагсаалтаар харуулна: төрөл (vector/raster/wms/wmts), store, нэр.
// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "№", width: 48 },
  { id: "name", label: "Layer нэр" },
  { id: "type", label: "Төрөл", align: "center", width: 120 },
  { id: "store", label: "Store", width: 160 },
  { id: "", label: "Үйлдэл", align: "right", width: 120 },
];

const TYPE_COLOR = {
  vector: "info",
  raster: "warning",
  wms: "secondary",
  wmts: "success",
};

const TYPE_ICON = {
  vector: "mdi:vector-polyline",
  raster: "mdi:image-outline",
  wms: "mdi:cloud-outline",
  wmts: "mdi:grid",
};

export default function WorkspaceLayersTable({ workspaceId, workspaceName }) {
  const table = useTable({
    defaultDense: true,
    defaultOrder: "asc",
    defaultOrderBy: "type",
    defaultRowsPerPage: 10,
  });

  const { enqueueSnackbar } = useSnackbar();
  const popover = usePopover();
  const confirm = useBoolean();

  const { layers, layersLoading, layersMutation } =
    useGetWorkspaceLayers(workspaceId);
  const [search, setSearch] = useState("");
  const [viewSource, setViewSource] = useState(null); // {source, store} view үүсгэх

  // Style засвар — geoname‑тэй ижил тусдаа таб (window.open)‑аар нээнэ.
  const openStyleEditor = useCallback(
    (row) => {
      const q = new URLSearchParams({
        ws: String(workspaceId),
        layer: row.name,
        ws_name: workspaceName || "",
      });
      window.open(
        `/settings/gis/ws-style/?${q.toString()}`,
        "_blank",
        "noopener,noreferrer"
      );
    },
    [workspaceId, workspaceName]
  );
  const [menuRow, setMenuRow] = useState(null); // kebab цэс нээгдсэн мөр
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!menuRow) return;
    setDeleting(true);
    try {
      await axiosInstance.post(endpoints.workspace.gsDeleteView(workspaceId), {
        store: menuRow.store,
        name: menuRow.name,
      });
      enqueueSnackbar(`"${menuRow.name}" устлаа`, { variant: "success" });
      confirm.onFalse();
      setMenuRow(null);
      await layersMutation();
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || e.message, {
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  }, [menuRow, workspaceId, confirm, layersMutation, enqueueSnackbar]);

  const dataFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = layers.filter((r) =>
      !q
        ? true
        : [r.name, r.store, r.type].join(" ").toLowerCase().includes(q)
    );
    const dir = table.order === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      const av = a[table.orderBy] ?? "";
      const bv = b[table.orderBy] ?? "";
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [layers, search, table.order, table.orderBy]);

  const dataPaged = dataFiltered.slice(
    table.page * table.rowsPerPage,
    table.page * table.rowsPerPage + table.rowsPerPage
  );

  const notFound = !layersLoading && !dataFiltered.length;

  return (
    <Card>
      <Box sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          {workspaceName} — GeoServer layer{" "}
          <Typography component="span" variant="body2" color="text.secondary">
            ({dataFiltered.length})
          </Typography>
        </Typography>
        <TextField
          fullWidth
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            table.onResetPage();
          }}
          placeholder="Layer, store хайх..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: "text.disabled" }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer sx={{ position: "relative", overflow: "unset" }}>
        <Scrollbar>
          <Table size={table.dense ? "small" : "medium"} sx={{ minWidth: 640 }}>
            <TableHeadCustom
              headLabel={TABLE_HEAD}
              order={table.order}
              orderBy={table.orderBy}
              onSort={table.onSort}
            />
            <TableBody>
              {layersLoading
                ? Array.from({ length: table.rowsPerPage }).map((_, i) => (
                    <TableSkeleton key={i} headLength={TABLE_HEAD.length} />
                  ))
                : dataPaged.map((row, i) => (
                    <TableRow key={`${row.store}-${row.name}`} hover>
                      <TableCell>
                        {table.page * table.rowsPerPage + i + 1}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {row.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {workspaceName}:{row.name}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          variant="soft"
                          color={TYPE_COLOR[row.type] || "default"}
                          icon={
                            <Iconify
                              icon={TYPE_ICON[row.type] || "mdi:layers"}
                              width={16}
                            />
                          }
                          label={row.type}
                        />
                      </TableCell>
                      <TableCell>{row.store}</TableCell>
                      <TableCell align="right" sx={{ px: 1 }}>
                        <IconButton
                          color={
                            menuRow?.name === row.name && popover.open
                              ? "inherit"
                              : "default"
                          }
                          onClick={(e) => {
                            setMenuRow(row);
                            popover.onOpen(e);
                          }}
                        >
                          <Iconify icon="eva:more-vertical-fill" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              <TableNoData notFound={notFound} />
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      <TablePaginationCustom
        count={dataFiltered.length}
        page={table.page}
        onPageChange={table.onChangePage}
        rowsPerPage={table.rowsPerPage}
        onRowsPerPageChange={table.onChangeRowsPerPage}
        dense={table.dense}
        onChangeDense={table.onChangeDense}
      />

      {/* Мөрийн үйлдлийн 3 цэгийн цэс */}
      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 200 }}
      >
        <MenuItem
          onClick={() => {
            if (menuRow) openStyleEditor(menuRow);
            popover.onClose();
          }}
        >
          <Iconify icon="solar:pallete-2-bold" />
          Style засах
        </MenuItem>

        {menuRow?.type === "vector" && (
          <MenuItem
            onClick={() => {
              setViewSource({ source: menuRow?.name, store: menuRow?.store });
              popover.onClose();
            }}
          >
            <Iconify icon="solar:layers-minimalistic-bold" />
            View үүсгэх
          </MenuItem>
        )}

        <Divider sx={{ borderStyle: "dashed" }} />

        <MenuItem
          onClick={() => {
            confirm.onTrue();
            popover.onClose();
          }}
          sx={{ color: "error.main" }}
        >
          <Iconify icon="solar:trash-bin-trash-bold" />
          Устгах
        </MenuItem>
      </CustomPopover>

      {/* Устгах баталгаажуулалт */}
      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Layer устгах"
        content={
          <>
            <b>{menuRow?.name}</b> layer‑ийг GeoServer‑ээс хасах уу? View бол
            баазаас устана; эх хүснэгт бол зөвхөн нийтлэлээс хасагдаж, өгөгдөл
            хэвээр үлдэнэ.
          </>
        }
        action={
          <Button
            variant="contained"
            color="error"
            disabled={deleting}
            onClick={handleDelete}
          >
            Устгах
          </Button>
        }
      />

      {/* Ангилж view үүсгэх форм */}
      <WorkspaceCreateViewForm
        open={!!viewSource}
        workspaceId={workspaceId}
        source={viewSource?.source}
        store={viewSource?.store}
        onClose={() => setViewSource(null)}
        onCreated={() => layersMutation()}
      />
    </Card>
  );
}

WorkspaceLayersTable.propTypes = {
  workspaceId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  workspaceName: PropTypes.string,
};
