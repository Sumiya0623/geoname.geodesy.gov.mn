"use client";

import PropTypes from "prop-types";
import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";

import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import Button from "@mui/material/Button";
import { Box, Collapse, Tooltip, IconButton } from "@mui/material";
import Container from "@mui/material/Container";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import { paths } from "src/routes/paths";
import { useBoolean } from "src/hooks/use-boolean";
import { useSettingsContext } from "src/components/settings";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";

import axiosInstance, { endpoints } from "src/utils/axios";

import { useGetConstants, useGetMenus } from "src/api/constant";

import Iconify from "src/components/iconify";
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

import ConstantTableRow from "../constant-table-row";
import ConstantNewEditForm from "../constant-new-edit-form";
import ConstantTableToolbar from "../constant-table-toolbar";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 10 },
  { id: "name", label: "Нэр" },
  { id: "key", label: "Түлхүүр үг" },
  { id: "parent", label: "Харъяа" },
  { id: "code", label: "Code" },
  { id: "label", label: "Label" },
  { id: "" },
];

const defaultFilters = {
  parent: "",
};

// ----------------------------------------------------------------------

export default function ConstantListView({ embedded = false }) {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({
    defaultDense: true,
    defaultOrder: "desc",
    defaultOrderBy: "key",
    defaultRowsPerPage: 10,
  });

  const menuPermissions = useMenuPermissions({ content: "constant" });
  const form = useBoolean();
  const [filters, setFilters] = useState(defaultFilters);
  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      ...filters,
    }),
    [filters, table.order, table.orderBy, table.page, table.rowsPerPage]
  );

  const {
    constants,
    constantsEmpty,
    constantsMutation,
    constantsLoading,
    constantsCount,
  } = useGetConstants(requestBody);

  const { menus: parents } = useGetMenus("menus");

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
          endpoints.constant.delete(id)
        );

        if (response?.status === 204) {
          constantsMutation();
          enqueueSnackbar("Тогтмол амжилттай устгагдлаа");
          return;
        }
      } catch (error) {
        const { status, data } = error?.response || {};

        let message;
        if (status === 403) {
          // 403 үед зөвхөн backend‑ээс ирсэн detail эсвэл
          // тогтмол монгол текстийг харуулна
          message =
            (data && typeof data === "object" && data.detail) ||
            "Танд энэ тогтмолыг устгах эрх байхгүй байна.";
        } else {
          message =
            (data && typeof data === "object" && data.detail) ||
            (typeof data === "string" && data) ||
            `Тогтмолыг устгах үед алдаа гарлаа (код: ${status ?? "UNKNOWN"})`;
        }

        enqueueSnackbar(message, { variant: "warning" });
      }
    },
    [constantsMutation, enqueueSnackbar]
  );

  const createAction = menuPermissions?.create ? (
    <Tooltip title="Тогтмол нэмэх">
      <IconButton color="primary" onClick={form.onToggle} id="constant-create">
        <Iconify icon="mingcute:add-line" />
      </IconButton>
    </Tooltip>
  ) : null;

  const renderTableToolbar = (
    <ConstantTableToolbar
      filters={filters}
      onFilters={handleFilters}
      //
      canReset={canReset}
      onReset={handleResetFilters}
      action={embedded ? createAction : undefined}
    />
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />
  );

  const renderTableRows = constants?.map((row, index) => (
    <ConstantTableRow
      key={row.id}
      row={row}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      menuPermissions={menuPermissions}
      refetch={constantsMutation}
      onDeleteRow={() => handleDeleteRow(row.id)}
      parents={parents}
    />
  ));

  const renderTableEmpty = <TableNoData notFound={constantsEmpty} />;

  return (
    <Container
      maxWidth={embedded ? false : settings.themeStretch ? false : "xxl"}
      disableGutters={embedded}
    >
      {!embedded && (
        <CustomBreadcrumbs
          heading="Тогтмолын жагсаалт"
          links={[
            {
              name: "Тогтмол",
              href: paths.dashboard.constant.root,
            },
            {
              name: "Жагсаалт",
            },
          ]}
          action={
            menuPermissions?.create && (
              <Button
                color="primary"
                variant="contained"
                onClick={form.onToggle}
                id="constant-create"
                endIcon={
                  <Iconify
                    icon="mingcute:down-line"
                    sx={{
                      transition: (theme) => theme.transitions.create("all"),
                      ...(form.value && {
                        transform: "rotate(-180deg)",
                      }),
                    }}
                  />
                }
              >
                Тогтмол нэмэх
              </Button>
            )
          }
          sx={{ mb: { xs: 3, md: 1 } }}
        />
      )}

      <Collapse in={form.value} timeout="auto" unmountOnExit>
        <Box sx={{ mb: { xs: 3, md: 1 } }}>
          <ConstantNewEditForm
            onCloseForm={form.onFalse}
            //
            refetch={constantsMutation}
          />
        </Box>
      </Collapse>

      <Card>
        {renderTableToolbar}

        <TableContainer sx={{ position: "relative", overflow: "unset" }}>
          <Scrollbar>
            <Table
              size={table.dense ? "small" : "medium"}
              sx={{ minWidth: 800 }}
              id="constant-table"
            >
              <TableHeadCustom
                headLabel={TABLE_HEAD}
                //
                order={table.order}
                onSort={table.onSort}
                orderBy={table.orderBy}
              />

              <TableBody>
                {constantsLoading && renderTableRowsSkeleton}

                {!constantsLoading && constants?.length > 0 && renderTableRows}

                {renderTableEmpty}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        <TablePaginationCustom
          count={constantsCount}
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

ConstantListView.propTypes = {
  embedded: PropTypes.bool,
};
