"use client";

import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";

import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import Container from "@mui/material/Container";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";

import { enqueueSnackbar } from "notistack";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetActs } from "src/api/champaign";
import { useAuthContext } from "src/auth/hooks";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";

import Scrollbar from "src/components/scrollbar";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";

import ActTableRow from "../act-table-row";
import ActTableToolbar from "../act-table-toolbar";

const TABLE_HEAD = [
  { id: "", label: "№", width: 10 },
  { id: "measurements", label: "Цэг" },
  { id: "network", label: "Сүлжээ" },
  { id: "projectId", label: "Төсөл" },
  { id: "engineer", label: "Илгээсэн" },
  { id: "act", label: "Акт" },
  { id: "verified", label: "Баталгаажсан" },
  { id: "", label: "", width: 10 },
];

const defaultFilters = {
  name: "",
  project__name: "",
  point_name_or_number: "",
  accepted_state: "",
};

export default function ActListView({ projectId = null, pointId = null, user }) {
  const menuPermissions = useMenuPermissions({ content: "act" });
  const table = useTable({
    defaultDense: true,
    defaultOrder: "desc",
    defaultOrderBy: "name",
    defaultRowsPerPage: 10,
  });

  const { user: authUser } = useAuthContext();

  const isOfficer = authUser?.roles?.some((role) =>
    role?.name?.toLowerCase().includes("аймгийн"),
  );

  const [seeOwn, setSeeOwn] = useState(isOfficer);
  const [filters, setFilters] = useState(defaultFilters);
  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      ...(projectId && { measurement__projectId: projectId }),
      ...(pointId && { measurement__point: pointId }),
      ...(user?.id && { act_user_in: user.id }),
      ...(seeOwn && { officer__id: authUser?.id }),
      ...filters,
    }),
    [
      filters,
      table.page,
      table.rowsPerPage,
      table.order,
      table.orderBy,
      projectId,
      pointId,
      user?.id,
      seeOwn,
      authUser?.id,
    ],
  );
  const { acts, actsEmpty, actsMutation, actsLoading, actsCount } =
    useGetActs(requestBody);

  const handleFilters = useCallback(
    (name, value) => {
      table.onResetPage();
      setFilters((prev) => ({ ...prev, [name]: value }));
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
          endpoints.champaign.act.delete(id),
        );
        if (response?.status === 204) {
          actsMutation();
          enqueueSnackbar(`Aкт амжилттай устгагдлаа`);
        }
      } catch (error) {
        enqueueSnackbar(error?.message || "Aкт устгах үед алдаа гарлаа", {
          variant: error?.message ? "warning" : "error",
        });
      }
    },
    [actsMutation],
  );
  const renderTableToolbar = (
    <ActTableToolbar
      filters={filters}
      onFilters={handleFilters}
      canReset={canReset}
      refetch={actsMutation}
      onReset={handleResetFilters}
      menuPermissions={menuPermissions}
      pointId={pointId}
      projectId={projectId}
      setSeeOwn={setSeeOwn}
      seeOwn={seeOwn}
    />
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />,
  );

  const renderTableRows = acts?.map((row, index) => (
    <ActTableRow
      key={row.id}
      row={row}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      refetch={actsMutation}
      onDeleteRow={() => handleDeleteRow(row.id)}
      tableHeadLength={TABLE_HEAD.length}
      projectId={projectId}
      user={user || authUser}
      pointId={pointId}
      menuPermissions={menuPermissions}
    />
  ));

  const renderTableEmpty = <TableNoData notFound={actsEmpty} />;

  const content = (
    <Card>
      {renderTableToolbar}

      <TableContainer sx={{ position: "relative", overflow: "unset" }}>
        <Scrollbar>
          <Table
            id="act-table"
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
              {actsLoading && renderTableRowsSkeleton}
              {!actsLoading && acts?.length > 0 && renderTableRows}
              {renderTableEmpty}
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      <TablePaginationCustom
        count={actsCount}
        page={table.page}
        onPageChange={table.onChangePage}
        rowsPerPage={table.rowsPerPage}
        onRowsPerPageChange={table.onChangeRowsPerPage}
        dense={table.dense}
        onChangeDense={table.onChangeDense}
      />
    </Card>
  );

  if (user || projectId || pointId) {
    return content;
  }

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="Актын жагсаалт"
        links={[{ name: "Акт" }, { name: "Жагсаалт" }]}
      />

      {content}
    </Container>
  );
}
