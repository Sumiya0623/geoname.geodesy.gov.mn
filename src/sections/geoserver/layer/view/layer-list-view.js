"use client";

import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import Container from "@mui/material/Container";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import axiosInstance, { endpoints } from "src/utils/axios";
import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";

import LayerTableRow from "../layer-table-row";
import LayerTableToolbar from "../layer-table-toolbar";
import { useGetLayers } from "src/api/map";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import { paths } from "src/routes/paths";
import { getAxiosErrorMessage } from "src/utils/error-snack";

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 10 },
  { id: "name", label: "Нэр" },
  { id: "table__code__name", label: "Geom" },
  { id: "is_published", label: "Идэвхитэй" },
  { id: "rules", label: "CQL Filter", noSort: true },
  { id: "" },
];

const defaultFilters = {
  system: "",
  store: "",
  point_unit_in: "",
  unit: "",
};

export default function LayerListView({ stId }) {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({
    defaultDense: true,
    defaultOrder: "desc",
    defaultOrderBy: "id",
    defaultRowsPerPage: 10,
  });

  const menuPermissions = useMenuPermissions({ content: "layer" });
  const [filters, setFilters] = useState(defaultFilters);

  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      ...filters,
      store: stId,
    }),
    [filters, table.order, table.orderBy, table.page, table.rowsPerPage, stId],
  );

  const { layers, layersEmpty, layersMutation, layersLoading, layersCount } =
    useGetLayers(requestBody);

  const handleFilters = useCallback(
    (name, value) => {
      table.onResetPage();
      setFilters((prevState) => ({
        ...prevState,
        [name]: value,
      }));
    },
    [table],
  );

  const handleResetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);
  const canReset = !isEqual(defaultFilters, filters);

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        const response = await axiosInstance.delete(
          endpoints.geoserver.layer.delete(id),
        );
        if (response?.status === 204) {
          layersMutation();
          enqueueSnackbar(`Давхаргыг амжилттай устгагдлаа`);
        }
      } catch (error) {
        enqueueSnackbar(getAxiosErrorMessage(error), {
          variant: "warning", // эсвэл "error" – таны UX-с хамаарна
        });
      }
    },
    [layersMutation, enqueueSnackbar],
  );

  const renderTableToolbar = (
    <LayerTableToolbar
      filters={filters}
      onFilters={handleFilters}
      stId={stId}
      canReset={canReset}
      refetch={layersMutation}
      onReset={handleResetFilters}
      menuPermissions={menuPermissions}
    />
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />,
  );

  const renderTableRows = layers?.map((row, index) => (
    <LayerTableRow
      key={row.id}
      row={row}
      stId={stId}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      menuPermissions={menuPermissions}
      refetch={layersMutation}
      onDeleteRow={() => handleDeleteRow(row.id)}
      tableHeadLength={TABLE_HEAD.length}
    />
  ));

  const renderTableEmpty = <TableNoData notFound={layersEmpty} />;

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="Давхаргын тохиргоо"
        links={[
          {
            name: "Geoserver",
            href: paths.dashboard.geoserver.root,
          },
          {
            name: "Layers",
            href: paths.dashboard.geoserver.layers(stId),
          },
          {
            name: "Жагсаалт",
          },
        ]}
      />
      <Card>
        {renderTableToolbar}

        <TableContainer sx={{ position: "relative", overflow: "unset" }}>
          <Scrollbar>
            <Table
              size={table.dense ? "small" : "medium"}
              sx={{ minWidth: 800 }}
            >
              <TableHeadCustom
                headLabel={TABLE_HEAD}
                order={table.order}
                onSort={table.onSort}
                orderBy={table.orderBy}
              />

              <TableBody>
                {layersLoading && renderTableRowsSkeleton}
                {!layersLoading && layers?.length > 0 && renderTableRows}
                {renderTableEmpty}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

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
    </Container>
  );
}
