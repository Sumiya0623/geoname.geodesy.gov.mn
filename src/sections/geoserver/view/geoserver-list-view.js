"use client";

import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";

import Card from "@mui/material/Card";

import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import { useTable, TablePaginationCustom } from "src/components/table";
import { useGetConstants } from "src/api/constant";
import { useBoolean } from "src/hooks/use-boolean";
import LazyTreeView from "../LazyTreeView";
import GeoServerTableToolbar from "../geoserver-table-toolbar";
import { getAxiosErrorMessage } from "src/utils/error-snack";
import { Box } from "@mui/material";

const defaultFilters = {
  name: "",
  parent: "",
};

export default function GeoServerListView() {
  const form = useBoolean();
  const { enqueueSnackbar } = useSnackbar();
  const menuPermissions = useMenuPermissions({ content: "geoserver" });

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
      key: "WORKSPACES",
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
  const [editingRoot, setEditingRoot] = useState(null);
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
          endpoints.network.delete(id)
        );
        if (response?.status === 204) {
          constantsMutation();
          enqueueSnackbar(`Тохиргоог амжилттай устгагдлаа`);
        }
      } catch (error) {
        enqueueSnackbar(getAxiosErrorMessage(error), {
          variant: "warning", // эсвэл "error" – таны UX-с хамаарна
        });
      }
    },
    [constantsMutation, enqueueSnackbar]
  );

  const renderTableToolbar = (
    <GeoServerTableToolbar
      filters={filters}
      onFilters={handleFilters}
      canReset={canReset}
      onReset={handleResetFilters}
      menuPermissions={menuPermissions}
    />
  );

  return (
    <Card>
      {renderTableToolbar}
      <Box id='geoserver-table'>
        {!constantsLoading && constants?.length > 0 && (
          <LazyTreeView
            constants={constants}
            onEditRoot={(root) => {
              setEditingRoot(root);
              if (!form.value) form.onTrue();
            }}
            handleDeleteRow={handleDeleteRow}
            rootMutation={constantsMutation}
            menuPermissions={menuPermissions}
          />
        )}
      </Box>

      <TablePaginationCustom
        count={constantsCount}
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
