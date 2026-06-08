import PropTypes from "prop-types";
import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";

import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetWorkspaceTypeViews } from "src/api/workspace";

import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";

import WorkspaceViewsRow from "./workspace-views-row";
import WorkspaceViewsToolbar from "./workspace-views-toolbar";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "№", width: 48 },
  { id: "view", label: "View нэр" },
  { id: "geom", label: "Геометр", align: "center", width: 90 },
  { id: "level1", label: "Ангилал" },
  { id: "level2", label: "Анхдагч" },
  { id: "level3", label: "Дэд" },
  { id: "", label: "Үйлчилгээ", align: "center", width: 210 },
];

const defaultFilters = { search: "", level1: "", level2: "", level3: "" };

const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();

// ----------------------------------------------------------------------

export default function WorkspaceViewsTable({ workspaceId, workspaceName }) {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({
    defaultDense: true,
    defaultOrder: "asc",
    defaultOrderBy: "level1",
    defaultRowsPerPage: 10,
  });
  const { views, viewsLoading, viewsMutation } =
    useGetWorkspaceTypeViews(workspaceId);
  const [filters, setFilters] = useState(defaultFilters);
  const [busy, setBusy] = useState(null);
  const handleFilters = useCallback(
    (name, value) => {
      table.onResetPage();
      setFilters((prev) => {
        const next = { ...prev, [name]: value };
        if (name === "level1") {
          next.level2 = "";
          next.level3 = "";
        } else if (name === "level2") {
          next.level3 = "";
        }
        return next;
      });
    },
    [table],
  );

  const handleResetFilters = useCallback(() => {
    setFilters(defaultFilters);
    table.onResetPage();
  }, [table]);

  const canReset = !isEqual(defaultFilters, filters);

  // Dependent dropdown сонголтууд
  const level1Opts = useMemo(() => uniq(views.map((r) => r.level1)), [views]);
  const level2Opts = useMemo(
    () =>
      uniq(
        views.filter((r) => r.level1 === filters.level1).map((r) => r.level2),
      ),
    [views, filters.level1],
  );
  const level3Opts = useMemo(
    () =>
      uniq(
        views
          .filter(
            (r) => r.level1 === filters.level1 && r.level2 === filters.level2,
          )
          .map((r) => r.level3),
      ),
    [views, filters.level1, filters.level2],
  );

  // Шүүлт + сорт (client‑side)
  const dataFiltered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    let list = views.filter((r) => {
      if (filters.level1 && r.level1 !== filters.level1) return false;
      if (filters.level2 && r.level2 !== filters.level2) return false;
      if (filters.level3 && r.level3 !== filters.level3) return false;
      if (
        q &&
        ![r.view, r.level1, r.level2, r.level3, r.geom]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
    const dir = table.order === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      const av = a[table.orderBy] ?? "";
      const bv = b[table.orderBy] ?? "";
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [views, filters, table.order, table.orderBy]);

  const dataPaged = dataFiltered.slice(
    table.page * table.rowsPerPage,
    table.page * table.rowsPerPage + table.rowsPerPage,
  );

  const notFound = !viewsLoading && !dataFiltered.length;

  const handleService = useCallback(
    async (row, service, next) => {
      const k = `${row.view}:${service}`;
      setBusy(k);
      try {
        await axiosInstance.post(
          endpoints.workspace.gsLayerService(workspaceId),
          { layer: row.view, service, enabled: next },
        );
        await viewsMutation();
      } catch (error) {
        enqueueSnackbar(
          error?.response?.data?.detail ||
            `${service.toUpperCase()} тохиргоо хадгалахад алдаа гарлаа`,
          { variant: "warning" },
        );
      } finally {
        setBusy(null);
      }
    },
    [workspaceId, viewsMutation, enqueueSnackbar],
  );

  return (
    <Card>
      <WorkspaceViewsToolbar
        filters={filters}
        onFilters={handleFilters}
        canReset={canReset}
        onReset={handleResetFilters}
        level1Opts={level1Opts}
        level2Opts={level2Opts}
        level3Opts={level3Opts}
      />

      <TableContainer sx={{ position: "relative", overflow: "unset" }}>
        <Scrollbar>
          <Table size={table.dense ? "small" : "medium"} sx={{ minWidth: 900 }}>
            <TableHeadCustom
              headLabel={TABLE_HEAD}
              order={table.order}
              orderBy={table.orderBy}
              onSort={table.onSort}
            />

            <TableBody>
              {viewsLoading
                ? Array.from({ length: table.rowsPerPage }).map((_, i) => (
                    <TableSkeleton key={i} headLength={TABLE_HEAD.length} />
                  ))
                : dataPaged.map((row, i) => (
                    <WorkspaceViewsRow
                      key={`${row.view}-${row.type_id}`}
                      row={row}
                      no={table.page * table.rowsPerPage + i + 1}
                      busy={busy}
                      onService={handleService}
                    />
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
    </Card>
  );
}

WorkspaceViewsTable.propTypes = {
  workspaceId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  workspaceName: PropTypes.string,
};
