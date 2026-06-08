"use client";

import PropTypes from "prop-types";
import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";

import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";

import { paths } from "src/routes/paths";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import axiosInstance, { endpoints } from "src/utils/axios";
import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import { useTable, TablePaginationCustom } from "src/components/table";
import { useGetMenus } from "src/api/constant";
import { Collapse } from "@mui/material";
import { useBoolean } from "src/hooks/use-boolean";
import { Box } from "@mui/system";
import MenuNewEditForm from "src/sections/usermenu/menu-new-edit-form";
import LazyTreeView from "../LazyTreeView";
import NetWorkTableToolbar from "../menu-table-toolbar";

const defaultFilters = {
  name: "",
  parent: "",
};
export default function MenukListView({ iconOptions = [] }) {
  const form = useBoolean();
  const { enqueueSnackbar } = useSnackbar();
  const menuPermissions = useMenuPermissions({ content: "menus" });
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
      key: "PARENT_MENU",
      ...filters,
    }),
    [filters, table.order, table.orderBy, table.page, table.rowsPerPage],
  );

  const { menus, menusEmpty, menusMutation, menusLoading, menusCount } =
    useGetMenus(requestBody);
  const [editingRoot, setEditingRoot] = useState(null);
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
          endpoints.network.delete(id),
        );
        if (response?.status === 204) {
          menusMutation();
          enqueueSnackbar(`Menu амжилттай устгагдлаа`);
        }
      } catch (error) {
        const { status, data } = error?.response || {};
        const message =
          (data && typeof data === "object" && data.detail) ||
          (typeof data === "string" && data) ||
          `Устгах үед алдаа гарлаа (код: ${status ?? "UNKNOWN"})`;

        enqueueSnackbar(message, { variant: "warning" });
      }
    },
    [menusMutation, enqueueSnackbar],
  );

  const renderTableToolbar = (
    <NetWorkTableToolbar
      filters={filters}
      onFilters={handleFilters}
      canReset={canReset}
      onReset={handleResetFilters}
    />
  );

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="Хэрэглэгчийн цэс"
        links={[
          {
            name: "Цэс",
            href: paths.dashboard.activity,
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
              id="menu-create"
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
              нэмэх
            </Button>
          )
        }
      />
      <Collapse in={form.value} timeout="auto" unmountOnExit>
        <Box sx={{ mb: { xs: 3, md: 5 } }}>
          <MenuNewEditForm
            currentConstant={editingRoot}
            menus={menus}
            onCloseForm={() => {
              setEditingRoot(null);
              form.onFalse();
            }}
            refetch={() => {
              setEditingRoot(null);
              menusMutation();
            }}
            parentCreate={true}
          />
        </Box>
      </Collapse>
      <Card sx={{ px: 2 }}>
        {renderTableToolbar}
        <Box id="menu-table">
          {!menusLoading && menus?.length > 0 && (
            <LazyTreeView
              constants={menus}
              iconOptions={iconOptions}
              onEditRoot={(root) => {
                setEditingRoot(root);
                if (!form.value) form.onTrue();
              }}
              handleDeleteRow={handleDeleteRow}
              rootMutation={menusMutation}
              menuPermissions={menuPermissions}
              page={table.page + 1}
              perPage={table.rowsPerPage}
            />
          )}
        </Box>

        <TablePaginationCustom
          count={menusCount}
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

MenukListView.propTypes = {
  iconOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      src: PropTypes.string.isRequired,
    }),
  ),
};
