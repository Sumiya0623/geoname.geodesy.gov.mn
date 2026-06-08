"use client";

import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetMeasurements } from "src/api/measurement";
import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";

import MeasurementTableRow from "../measurement-table-row";
import MeasurementTableToolbar from "../measurement-table-toolbar";
import { getAxiosErrorMessage } from "src/utils/error-snack";

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 10 },
  { id: "point__name", label: "Нэр" },
  { id: "network", label: "Сүлжээ" },
  { id: "system", label: "Систем" },
  { id: "measured_engineer", label: "Хэмжсэн" },
  { id: "", label: "" },

  { id: "" },
];

const defaultFilters = {
  system_in: "",
  network_in: "",
  point_unit_in: "",
  point_id: "",
  point__number: "",
  point__name: "",
  unit1: "",
  unit2: "",
  unit3: "",
};

// ----------------------------------------------------------------------

export default function MeasurementListView({
  projectId = "",
  pointId = "",
  user,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({
    defaultDense: true,
    defaultOrder: "desc",
    defaultOrderBy: "id",
    defaultRowsPerPage: 10,
  });
  const menuPermissions = useMenuPermissions({ content: "measurement" });
  const [filters, setFilters] = useState(defaultFilters);
  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      ...filters,
      point_unit_in: filters.point_unit_in?.id ?? "",
      ...(projectId && { project: projectId }),
      ...(pointId && { point_id: pointId }),
      ...(user?.id && { measured_user_in: user.id }),
    }),
    [
      filters,
      table.order,
      table.orderBy,
      table.page,
      table.rowsPerPage,
      projectId,
      pointId,
      user?.id,
    ]
  );

  const {
    measurements,
    measurementsEmpty,
    measurementsMutation,
    measurementsLoading,
    measurementsCount,
  } = useGetMeasurements(requestBody);

  const allowMutations = !!projectId;
  const effectiveMenuPermissions = allowMutations ? menuPermissions : {};

  const handleFilters = useCallback(
    (name, value) => {
      table.onResetPage();
      setFilters((prevState) => ({
        ...prevState,
        [name]: value,
      }));
    },
    [table]
  );

  const handleResetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const canReset = !isEqual(defaultFilters, filters);

  const handleAddToCartRow = useCallback(
    async (id) => {
      try {
        const response = await axiosInstance.post(endpoints.order.add, {
          point_id: id,
        });
        if (response?.status === 200 || response?.status === 201) {
          enqueueSnackbar(`Сагсанд амжилттай нэмэгдлээ`);
        }
      } catch (error) {
        enqueueSnackbar(error?.message || "Сагсанд нэмэх үед алдаа гарлаа", {
          variant: error?.message ? "warning" : "error",
        });
      }
    },
    [enqueueSnackbar]
  );

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        const response = await axiosInstance.delete(
          endpoints.measurement.delete(id)
        );
        if (response?.status === 204) {
          measurementsMutation();
          enqueueSnackbar("Хэмжилт амжилттай устгагдлаа", {
            variant: "success",
          });
        }
      } catch (error) {
        enqueueSnackbar(getAxiosErrorMessage(error), {
          variant: "warning", // эсвэл "error" – таны UX-с хамаарна
        });
      }
    },
    [measurementsMutation, enqueueSnackbar]
  );

  const renderTableToolbar = (
    <MeasurementTableToolbar
      filters={filters}
      onFilters={handleFilters}
      projectId={projectId}
      pointId={pointId}
      menuPermissions={effectiveMenuPermissions}
      canReset={canReset}
      refetch={measurementsMutation}
      onReset={handleResetFilters}
    />
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />
  );

  const renderTableRows = measurements?.map((row, index) => (
    <MeasurementTableRow
      key={row.id}
      row={row}
      projectId={projectId}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      menuPermissions={effectiveMenuPermissions}
      refetch={measurementsMutation}
      addToCartRow={() => handleAddToCartRow(row?.id)}
      onDeleteRow={() => handleDeleteRow(row?.id)}
      tableHeadLength={TABLE_HEAD.length}
    />
  ));

  const renderTableEmpty = <TableNoData notFound={measurementsEmpty} />;

  return (
    <>
      <Card>
        {!pointId && renderTableToolbar}

        <TableContainer sx={{ position: "relative", overflow: "unset" }}>
          <Scrollbar>
            <Table
              size={table.dense ? "small" : "medium"}
              sx={{ minWidth: 800 }}
              id="service-measure"
            >
              <TableHeadCustom
                headLabel={TABLE_HEAD}
                order={table.order}
                onSort={table.onSort}
                orderBy={table.orderBy}
              />

              <TableBody>
                {measurementsLoading && renderTableRowsSkeleton}
                {!measurementsLoading &&
                  measurements?.length > 0 &&
                  renderTableRows}
                {renderTableEmpty}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        <TablePaginationCustom
          count={measurementsCount}
          page={table.page}
          onPageChange={table.onChangePage}
          rowsPerPage={table.rowsPerPage}
          onRowsPerPageChange={table.onChangeRowsPerPage}
          dense={table.dense}
          onChangeDense={table.onChangeDense}
        />
      </Card>
    </>
  );
}
