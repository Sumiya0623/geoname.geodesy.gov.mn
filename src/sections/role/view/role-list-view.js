"use client";

import PropTypes from "prop-types";
import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Collapse from "@mui/material/Collapse";
import Container from "@mui/material/Container";
import TableBody from "@mui/material/TableBody";
import IconButton from "@mui/material/IconButton";
import TableContainer from "@mui/material/TableContainer";

import { paths } from "src/routes/paths";
import { RouterLink } from "src/routes/components";
import { useRouter } from "src/routes/hooks";

import { useBoolean } from "src/hooks/use-boolean";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";

import axiosInstance, { endpoints } from "src/utils/axios";

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

import RoleTableRow from "../role-table-row";
import RoleNewEditForm from "../role-new-edit-form";
import RoleTableToolbar from "../role-table-toolbar";
import { useGetConstants, useGetMenus, useGetRole } from "src/api/constant";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 10 },
  { id: "name", label: "Нэр" },
  { id: "name", label: "Зөвшөөрсөн үйлдэл" },
  { id: "" },
];

const defaultFilters = {
  name: "",
};

export default function RoleListView({ embedded = false }) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const menuPermissions = useMenuPermissions({ content: "role" });

  // Embedded (таб доторх) горимд засвар/нэмэлтийг тусдаа хуудас руу
  // шилжихгүйгээр inline Collapse хэлбэрээр харуулна.
  const form = useBoolean();
  const [editingRole, setEditingRole] = useState(null);
  const { menus = [] } = useGetMenus();
  const { role: editingRoleFull } = useGetRole(editingRole?.id);
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
      key: "ROLES",
      ...filters,
    }),
    [filters, table.order, table.orderBy, table.page, table.rowsPerPage],
  );

  const {
    constants: roles,
    constantsEmpty: rolesEmpty,
    constantsMutation: rolesMutation,
    constantsLoading: rolesLoading,
    constantsCount: rolesCount,
  } = useGetConstants(requestBody);

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
          endpoints.constant.delete(id),
        );
        if (response?.status === 204) {
          rolesMutation();
          enqueueSnackbar(`Эрх амжилттай устгагдлаа`);
        }
      } catch (error) {
        enqueueSnackbar(error?.message || "Эрхийг устгах үед алдаа гарлаа", {
          variant: error?.message ? "warning" : "error",
        });
      }
    },
    [rolesMutation, enqueueSnackbar],
  );

  const handleEditRow = useCallback(
    (row) => {
      if (embedded) {
        setEditingRole(row);
        form.onTrue();
        return;
      }
      router.push(paths.dashboard.role.edit(row.id));
    },
    [router, embedded, form],
  );

  const handleViewRow = useCallback(
    (id) => {
      router.push(paths.dashboard.role.details(id));
    },
    [router],
  );

  const createAction = menuPermissions.create ? (
    <Tooltip title="Нэмэх">
      <IconButton
        color="primary"
        onClick={() => {
          setEditingRole(null);
          form.onTrue();
        }}
      >
        <Iconify icon="mingcute:add-line" />
      </IconButton>
    </Tooltip>
  ) : null;

  const renderTableToolbar = (
    <RoleTableToolbar
      filters={filters}
      onFilters={handleFilters}
      //
      canReset={canReset}
      onReset={handleResetFilters}
      action={embedded ? createAction : undefined}
    />
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />,
  );

  const renderTableRows = roles?.map((row, index) => (
    <RoleTableRow
      key={row.id}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      row={row}
      onViewRow={() => handleViewRow(row.id)}
      onEditRow={() => handleEditRow(row)}
      onDeleteRow={() => handleDeleteRow(row.id)}
      tableHeadLength={TABLE_HEAD.length}
      menuPermissions={menuPermissions}
    />
  ));

  const renderTableEmpty = <TableNoData notFound={rolesEmpty} />;

  return (
    <Container
      maxWidth={embedded ? false : "xxl"}
      disableGutters={embedded}
    >
      {!embedded && (
        <CustomBreadcrumbs
          heading="Эрхийн жагсаалт"
          links={[
            {
              name: "Эрх",
              href: paths.dashboard.role.root,
            },
            {
              name: "Жагсаалт",
            },
          ]}
          action={
            menuPermissions.create && (
              <Button
                color="primary"
                component={RouterLink}
                href={paths.dashboard.role.new}
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
              >
                Нэмэх
              </Button>
            )
          }
        />
      )}

      {embedded && (
        <Collapse in={form.value} timeout="auto" unmountOnExit>
          <Box sx={{ mb: 2 }}>
            <RoleNewEditForm
              currentRole={editingRole ? editingRoleFull : null}
              menus={menus}
              onCloseForm={() => {
                setEditingRole(null);
                form.onFalse();
              }}
              refetch={rolesMutation}
            />
          </Box>
        </Collapse>
      )}

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
                //
                order={table.order}
                onSort={table.onSort}
                orderBy={table.orderBy}
              />

              <TableBody>
                {rolesLoading && renderTableRowsSkeleton}

                {!rolesLoading && roles?.length > 0 && renderTableRows}

                {renderTableEmpty}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        <TablePaginationCustom
          count={rolesCount}
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

RoleListView.propTypes = {
  embedded: PropTypes.bool,
};
