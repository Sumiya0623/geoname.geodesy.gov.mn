"use client";

import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";

import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import Container from "@mui/material/Container";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";

import { useSettingsContext } from "src/components/settings";
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

import CountTableRow from "../count-table-row";
import {
  useGetCounts,
} from "src/api/point";
import CountTableToolbar from "../count-table-toolbar";
import { useAuthContext } from "src/auth/hooks";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 10 },
  { id: "point__name", label: "Нэр" },
  { id: "point__number", label: "Дугаар" },
  { id: "counted_by", label: "Илгээсэн" },
  { id: "counted_date", label: "Огноо" },
  { id: "description", label: "Тайлбар" },
  { id: "status", label: "Төлөв" },
  { id: "confirmed_by", label: "Баталсан" },
  { id: "action", label: "", width: 80 },
];

const defaultFilters = {
  parent: "",
};

// ----------------------------------------------------------------------

export default function CountListView({ pointId='' }) {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({
    defaultDense: true,
    defaultOrder: "desc",
    defaultOrderBy: "key",
    defaultRowsPerPage: 10,
  });

  const menuPermissions = useMenuPermissions({ content: "count" });
  const decidePermissions = useMenuPermissions({ content: "count_decide" });

  const { user } = useAuthContext()

  const [filters, setFilters] = useState(defaultFilters);
  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      point_id: pointId,
      ...filters,
    }),
    [filters, table.order, table.orderBy, table.page, table.rowsPerPage, pointId]
  );

  const { counts, countsEmpty, countsMutation, countsLoading, countsCount } =
    useGetCounts(requestBody);

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

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        const response = await axiosInstance.delete(
          endpoints.point.count.delete(id)
        );
        if (response?.status === 204) {
          countsMutation();
          enqueueSnackbar(`Тооллого амжилттай устгагдлаа`);
        }
      } catch (error) {
        enqueueSnackbar(error?.message || "Тооллого устгах үед алдаа гарлаа", {
          variant: error?.message ? "warning" : "error",
        });
      }
    },
    [countsMutation, enqueueSnackbar]
  );

  const renderTableToolbar = (
    <CountTableToolbar
      refetch={countsMutation}
      filters={filters}
      onFilters={handleFilters}
      canReset={canReset}
      onReset={handleResetFilters}
      menuPermissions={menuPermissions}
      pointId={pointId}
    />
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />
  );

  const renderTableRows = counts?.map((row, index) => (
    <CountTableRow
      key={row.id}
      row={row}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      menuPermissions={menuPermissions}
      refetch={countsMutation}
      onDeleteRow={() => handleDeleteRow(row.id)}
      decidePermissions={decidePermissions}
      user={user}
    />
  ));

  const renderTableEmpty = <TableNoData notFound={countsEmpty} />;

  return (
    <Container sx={{ px: '0!important' }} maxWidth={settings.themeStretch ? false : "xxl"}>
      <Card sx={{ p: 0 }}>
        {renderTableToolbar}

        <TableContainer sx={{ position: "relative", overflow: "unset" }}>
          <Scrollbar>
            <Table
              size={table.dense ? "small" : "medium"}
              sx={{ minWidth: 800 }}
            >
              <TableHeadCustom
                headLabel={TABLE_HEAD}
                //
                order={table.order}
                onSort={table.onSort}
                orderBy={table.orderBy}
              />

              <TableBody>
                {countsLoading && renderTableRowsSkeleton}

                {!countsLoading && counts?.length > 0 && renderTableRows}

                {renderTableEmpty}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        <TablePaginationCustom
          count={countsCount}
          //
          page={table.page}
          onPageChange={table.onChangePage}
          //
          rowsPerPage={table.rowsPerPage}
          onRowsPerPageChange={table.onChangeRowsPerPage}
          //
          dense={table.dense}
          onChangeDense={table.onChangeDense}
        />
      </Card>
    </Container>
  );
}
