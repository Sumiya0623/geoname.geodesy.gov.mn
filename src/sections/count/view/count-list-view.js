"use client";

import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";

import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import Container from "@mui/material/Container";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";

import { paths } from "src/routes/paths";

import { useSettingsContext } from "src/components/settings";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";

import axiosInstance, { endpoints } from "src/utils/axios";

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

import CountTableRow from "../count-table-row";
import { useGetCounts } from "src/api/point";
import CountTableToolbar from "../count-table-toolbar";
import CountTableStatusBar from "../count-table-status";
import { useGetConstantsFordropdown } from "src/api/constant";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 10 },
  { id: "point__name", label: "Нэр" },
  { id: "point__number", label: "Төсөл" },
  { id: "counted_by", label: "Илгээсэн" },
  { id: "counted_date", label: "Огноо" },
  { id: "status", label: "Төлөв" },
  { id: "confirmed_by", label: "Баталсан" },
  { id: "action", label: "", width: 80 },
];

const defaultFilters = {
  parent: "",
};

// ----------------------------------------------------------------------

export default function CountListView({ user = null, projectId = null }) {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const table = useTable({
    defaultDense: true,
    defaultOrder: "desc",
    defaultOrderBy: "-id",
    defaultRowsPerPage: 10,
  });

  const menuPermissions = useMenuPermissions({ content: "count" });
  const decidePermissions = useMenuPermissions({ content: "count_decide" });

  const [filters, setFilters] = useState(defaultFilters);
  const [statusTab, setStatusTab] = useState("");

  const { constants: pointStatuses = [] } =
    useGetConstantsFordropdown("POINTSTATUS");

  const statusTabBody = useMemo(() => {
    if (!statusTab) return {};
    if (statusTab === "pending" || statusTab === "accepted") {
      return { accepted_state: statusTab };
    }
    const nameKey = statusTab === "normal" ? "хэвийн" : "устсан";
    const match = pointStatuses.find(
      (s) => s?.name && s.name.trim().toLowerCase() === nameKey,
    );
    return match ? { status_in: match.id } : {};
  }, [statusTab, pointStatuses]);

  const baseBody = useMemo(
    () => ({
      ...filters,
      ...(user?.id && { count_user_in: user.id }),
      ...(projectId && { project: projectId }),
    }),
    [filters, user?.id, projectId],
  );

  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      ...baseBody,
      ...statusTabBody,
    }),
    [
      baseBody,
      statusTabBody,
      table.order,
      table.orderBy,
      table.page,
      table.rowsPerPage,
    ],
  );

  const handleStatusTabChange = useCallback(
    (v) => {
      table.onResetPage();
      setStatusTab(v);
    },
    [table],
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
          endpoints.point.count.delete(id),
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
    [countsMutation, enqueueSnackbar],
  );

  const renderTableToolbar = (
    <CountTableToolbar
      refetch={countsMutation}
      filters={filters}
      onFilters={handleFilters}
      canReset={canReset}
      onReset={handleResetFilters}
      menuPermissions={menuPermissions}
      projectId={projectId}
    />
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />,
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
      projectId={projectId}
      user={user}
    />
  ));

  const renderTableEmpty = <TableNoData notFound={countsEmpty} />;

  const content = (
    <Card>
      <CountTableStatusBar
        value={statusTab}
        onChange={handleStatusTabChange}
        baseBody={baseBody}
      />
      {renderTableToolbar}

      <TableContainer sx={{ position: "relative", overflow: "unset" }}>
        <Scrollbar>
          <Table
            size={table.dense ? "small" : "medium"}
            sx={{ minWidth: 800 }}
            id="count-table"
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
  );

  // Profile эсвэл champaign дотор ашиглах үед (headerгүй, өргөнийг parent‑тэй нь тэнцүүлнэ)
  if (user || projectId) {
    return content;
  }

  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <CustomBreadcrumbs
        heading="Тооллогын мэдээлэл"
        links={[
          {
            name: "Тооллого",
            href: paths.dashboard.point.count.root,
          },
          {
            name: "Жагсаалт",
          },
        ]}
      />
      {content}
    </Container>
  );
}
