"use client";

import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import { useBoolean } from "src/hooks/use-boolean";
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

import { useGetGroups } from "src/api/group";
import GroupTableToolbar from "../group-table-toolbar";
import GroupTableRow from "../group-table-row";
import { getAxiosErrorMessage } from "src/utils/error-snack";

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 10 },
  { id: "name", label: "Групын нэр" },
  { id: "items_count", label: "Layer тоо" },
  { id: "features", label: "Давхаргууд" },
  { id: "" },
];

const defaultFilters = {
  name: "",
};

// ----------------------------------------------------------------------

export default function GroupListView({ styleId }) {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({
    defaultDense: true,
    defaultOrder: "desc",
    defaultOrderBy: "id",
    defaultRowsPerPage: 10,
  });

  const menuPermissions = useMenuPermissions({ content: "layergroup" });
  const form = useBoolean();
  const [filters, setFilters] = useState(defaultFilters);
  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      style: styleId ? styleId : "",
      ...filters,
    }),
    [
      filters,
      table.order,
      table.orderBy,
      table.page,
      table.rowsPerPage,
      styleId,
    ]
  );

  const { groups, groupsEmpty, groupsMutation, groupsLoading, groupsCount } =
    useGetGroups(requestBody);

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
          endpoints.geoserver.group.delete(id)
        );
        if (response?.status === 204) {
          groupsMutation();
          enqueueSnackbar(`Layer Group амжилттай устгагдлаа`);
        }
      } catch (error) {
        enqueueSnackbar(getAxiosErrorMessage(error), {
          variant: "error", // эсвэл "error" – таны UX-с хамаарна
        });
      }
    },
    [groupsMutation, enqueueSnackbar]
  );

  const renderTableToolbar = (
    <GroupTableToolbar
      filters={filters}
      onFilters={handleFilters}
      canReset={canReset}
      refetch={groupsMutation}
      onReset={handleResetFilters}
      menuPermissions={menuPermissions}
    />
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />
  );

  const renderTableRows = groups?.map((row, index) => (
    <GroupTableRow
      key={row.id}
      row={row}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      menuPermissions={menuPermissions}
      refetch={groupsMutation}
      onDeleteRow={() => handleDeleteRow(row.id)}
      tableHeadLength={TABLE_HEAD.length}
    />
  ));

  const renderTableEmpty = <TableNoData notFound={groupsEmpty} />;

  return (
    <Card>
      {renderTableToolbar}
      <TableContainer sx={{ position: "relative", overflow: "unset" }}>
        <Scrollbar>
          <Table size={table.dense ? "small" : "medium"} id='group-table' sx={{ minWidth: 800 }}>
            <TableHeadCustom
              headLabel={TABLE_HEAD}
              order={table.order}
              onSort={table.onSort}
              orderBy={table.orderBy}
            />

            <TableBody>
              {groupsLoading && renderTableRowsSkeleton}
              {!groupsLoading && groups?.length > 0 && renderTableRows}
              {renderTableEmpty}
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      <TablePaginationCustom
        count={groupsCount}
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
