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
import { useGetRelatedUsers } from "src/api/user";
import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";
import UserTableRow from "../user-table-row";
import UserTableToolbar from "../user-table-toolbar";
import { useGetUnitsFordropdown } from "src/api/unit";
import {
  useGetConstantsFordropdown,
  useGetConstantsForStatus,
} from "src/api/constant";
import UserTableStatusBar from "../user-table-status";
import { useAuthContext } from "src/auth/hooks";

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 10 },
  { id: "photo", label: "Хэрэглэгч" },
  { id: "org", label: "Байгууллага" },
  { id: "phone", label: "Утас" },
  { id: "email", label: "Имэйл" },
  { id: "" },
];

const defaultFilters = {
  first_name: "",
};

export default function UserListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({
    defaultDense: true,
    defaultOrder: "desc",
    defaultOrderBy: "id",
    defaultRowsPerPage: 10,
  });

  const { user } = useAuthContext();

  const menuPermissions = useMenuPermissions({ content: "user" });
  const [filters, setFilters] = useState(defaultFilters);
  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      ...filters,
    }),
    [filters, table.order, table.orderBy, table.page, table.rowsPerPage],
  );

  const { users, usersEmpty, usersMutation, usersLoading, usersCount } =
    useGetRelatedUsers(requestBody);
  const { units } = useGetUnitsFordropdown({ select__level: true });
  const { constants: roles = [] } = useGetConstantsFordropdown("ROLES");

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

  const { constants: roles_stat = [] } = useGetConstantsForStatus("USER_ROLES");

  const renderTableStatus = (
    <UserTableStatusBar
      filters={filters}
      onFilters={handleFilters}
      STATUSES={roles_stat}
    />
  );

  const handleResetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const canReset = !isEqual(defaultFilters, filters);

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        const response = await axiosInstance.delete(endpoints.user.delete(id));
        if (response?.status === 204) {
          usersMutation();
          enqueueSnackbar(`Хэрэглэгч амжилттай устгагдлаа`);
        }
      } catch (error) {
        enqueueSnackbar(
          error?.response?.data?.detail || "Устгах үед алдаа гарлаа",
          {
            variant: error?.message ? "warning" : "error",
          },
        );
      }
    },
    [usersMutation, enqueueSnackbar],
  );

  const renderTableToolbar = (
    <UserTableToolbar
      filters={filters}
      onFilters={handleFilters}
      canReset={canReset}
      onReset={handleResetFilters}
    />
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />,
  );

  const renderTableRows = users?.map((row, index) => (
    <UserTableRow
      key={row.id}
      row={row}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      menuPermissions={menuPermissions}
      refetch={usersMutation}
      units={units}
      roles={roles}
      tableHeadLength={TABLE_HEAD.length}
      onDeleteRow={() => handleDeleteRow(row.id)}
      user={user}
    />
  ));

  const renderTableEmpty = <TableNoData notFound={usersEmpty} />;

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="Хэрэглэгчийн жагсаалт"
        links={[
          {
            name: "Хэрэглэгч",
          },
          {
            name: "Жагсаалт",
          },
        ]}
      />

      <Card>
        {renderTableStatus}
        {renderTableToolbar}
        <TableContainer sx={{ position: "relative", overflow: "unset" }}>
          <Scrollbar>
            <Table
              size={table.dense ? "small" : "medium"}
              sx={{ minWidth: 800 }}
              id="user-table"
            >
              <TableHeadCustom
                headLabel={TABLE_HEAD}
                order={table.order}
                onSort={table.onSort}
                orderBy={table.orderBy}
              />
              <TableBody>
                {usersLoading && renderTableRowsSkeleton}
                {!usersLoading && users?.length > 0 && renderTableRows}
                {renderTableEmpty}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        <TablePaginationCustom
          count={usersCount}
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
