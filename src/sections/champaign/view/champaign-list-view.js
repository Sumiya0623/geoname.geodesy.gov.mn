"use client";

import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";

import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import Container from "@mui/material/Container";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";

import { useSnackbar } from "notistack";

import { paths } from "src/routes/paths";
import axiosInstance, { endpoints } from "src/utils/axios";
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

import ChampaignTableRow from "../champaign-table-row";
import ChampaignTableToolbar from "../champaign-table-toolbar";
import { useGetChampaigns } from "src/api/champaign";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 10 },
  { id: "name", label: "Гэрээт ажил" },
  { id: "number", label: "Дугаар" },
  { id: "signed_date", label: "Огноо" },
  { id: "org", label: "Байгуулллага" },
  { id: "" },
];

const defaultFilters = {};

export default function ChampaignListView({ user } = {}) {
  const { enqueueSnackbar } = useSnackbar();
  const menuPermissions = useMenuPermissions({ content: "agreement" });

  const table = useTable({
    defaultDense: true,
    defaultOrder: "desc",
    defaultOrderBy: "name",
    defaultRowsPerPage: 10,
  });
  const [filters, setFilters] = useState(defaultFilters);
  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      ...filters,
    }),
    [
      filters,
      table.order,
      table.orderBy,
      table.page,
      table.rowsPerPage,
      user?.id,
    ],
  );
  const { champaigns, champaignsCount, champaignsLoading, champaignsMutation } =
    useGetChampaigns(requestBody);

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        const res = await axiosInstance.delete(endpoints.champaign.details(id));
        if (res?.status === 204 || res?.status === 200) {
          enqueueSnackbar("Гэрээт ажил амжилттай устгагдлаа.", {
            variant: "success",
          });
          champaignsMutation();
        }
      } catch (error) {
        enqueueSnackbar(
          error?.response?.data?.detail ||
            error?.message ||
            "Устгах үед алдаа гарлаа.",
          { variant: "error" },
        );
      }
    },
    [champaignsMutation, enqueueSnackbar],
  );
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

  const renderTableToolbar = (
    <ChampaignTableToolbar
      filters={filters}
      onFilters={handleFilters}
      canReset={canReset}
      menuPermissions={menuPermissions}
      onReset={handleResetFilters}
      onRefetch={champaignsMutation}
    />
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />,
  );

  const renderTableRows = champaigns?.map((row, index) => (
    <ChampaignTableRow
      key={row.id}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      row={row}
      tableHeadLength={TABLE_HEAD.length}
      menuPermissions={menuPermissions}
      onDelete={handleDeleteRow}
    />
  ));

  const renderTableEmpty =
    !champaignsLoading && champaigns?.length === 0 ? (
      <TableNoData notFound />
    ) : null;

  const content = (
    <Card>
      {renderTableToolbar}
      <TableContainer sx={{ position: "relative", overflow: "unset" }}>
        <Scrollbar>
          <Table
            size={table.dense ? "small" : "medium"}
            sx={{ minWidth: 800 }}
            id="champaign-table"
          >
            <TableHeadCustom
              headLabel={TABLE_HEAD}
              order={table.order}
              onSort={table.onSort}
              orderBy={table.orderBy}
            />
            <TableBody>
              {champaignsLoading && renderTableRowsSkeleton}
              {!champaignsLoading && champaigns?.length > 0 && renderTableRows}
              {renderTableEmpty}
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      <TablePaginationCustom
        count={champaignsCount}
        page={table.page}
        onPageChange={table.onChangePage}
        rowsPerPage={table.rowsPerPage}
        onRowsPerPageChange={table.onChangeRowsPerPage}
        dense={table.dense}
        onChangeDense={table.onChangeDense}
      />
    </Card>
  );

  const containerNeeded = !user;

  if (!containerNeeded) {
    // Profile дотроос дуудагдсан: headerгүй, өргөнийг тэнцүүлж зөвхөн хүснэгт
    return content;
  }

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="Гэрээт ажлын сан"
        links={[
          {
            name: "Гэрээт ажил",
            href: paths.dashboard.champaign.root,
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
