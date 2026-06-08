import PropTypes from "prop-types";
import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  ListItemText,
  MenuItem,
  Divider,
  Checkbox,
  Stack,
  Tooltip,
} from "@mui/material";
import Iconify from "src/components/iconify";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import axiosInstance, { endpoints } from "src/utils/axios";
import { enqueueSnackbar } from "notistack";
import MeasurementNewEditForm from "./measurement-new-edit-form";
import { isGrav } from "../utils/isGrav";

// ----------------------------------------------------------------------

export default function MeasurementChildrenDialog({
  open,
  onClose,
  children = [],
  menuPermissions,
  onDelete,
  main,
  refetch,
  pointId: masterPointId,
}) {
  const pointId = main?.point?.id || masterPointId || null;

  const childPopover = usePopover();
  const [selectedItems, setSelectedItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentChild, setCurrentChild] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState(null);

  const datas = [...(main ? [main] : []), ...children];

  const handleAddToCartRow = async (measurementItem) => {
    try {
      const measurementId =
        typeof measurementItem === "object"
          ? measurementItem.id
          : measurementItem;

      const response = await axiosInstance.post(endpoints.order.add, {
        point_id: measurementId,
      });
      if (response?.status === 200 || response?.status === 201) {
        enqueueSnackbar(`Сагсанд амжилттай нэмэгдлээ`);
      }
    } catch (error) {
      enqueueSnackbar(error?.message || "Сагсанд нэмэх үед алдаа гарлаа", {
        variant: error?.message ? "warning" : "error",
      });
    }
  };

  const handleEdit = (child) => {
    setEditingMeasurement(child);
    setShowForm(true);
    childPopover.onClose();
  };

  const handleDelete = async (child) => {
    if (!child?.id) return;

    try {
      const response = await axiosInstance.delete(
        endpoints.measurement.delete(child.id)
      );

      if (response?.status === 200 || response?.status === 204) {
        enqueueSnackbar("Хэмжилт амжилттай устгагдлаа", { variant: "success" });

        if (refetch && typeof refetch === "function") {
          refetch();
        }

        setSelectedItems((prev) => prev.filter((id) => id !== child.id));
      }
    } catch (error) {
      enqueueSnackbar(error?.message || "Хэмжилт устгах үед алдаа гарлаа", {
        variant: error?.message ? "warning" : "error",
      });
    } finally {
      childPopover.onClose();
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = datas.map((item) => item.id);
      setSelectedItems(allIds);
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (itemId, checked) => {
    if (checked) {
      setSelectedItems((prev) => [...prev, itemId]);
    } else {
      setSelectedItems((prev) => prev.filter((id) => id !== itemId));
    }
  };

  const isAllSelected =
    datas.length > 0 && selectedItems.length === datas.length;
  const isIndeterminate =
    selectedItems.length > 0 && selectedItems.length < datas.length;

  const handleBulkAddToCart = async () => {
    if (selectedItems.length === 0) return;

    const selectedData = datas.filter((item) =>
      selectedItems.includes(item.id)
    );
    const gravItems = selectedData.filter((item) => !isGrav(item.network));

    if (gravItems.length !== selectedData.length) {
      enqueueSnackbar("Гравиметрийн хэмжилтийг сагсанд нэмэх боломжгүй.", {
        variant: "warning",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const promises = gravItems.map((item) => {
        return axiosInstance.post(endpoints.order.add, { point_id: item.id });
      });
      await Promise.all(promises);
      enqueueSnackbar(
        `${gravItems.length} хэмжилт сагсанд амжилттай нэмэгдлээ`
      );
      setSelectedItems([]);
    } catch (error) {
      enqueueSnackbar(error?.message || "Сагсанд нэмэх үед алдаа гарлаа", {
        variant: error?.message ? "warning" : "error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setSelectedItems([]);
    setShowForm(false);
    setEditingMeasurement(null);
    onClose();
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingMeasurement(null);
  };

  const handleFormRefetch = () => {
    if (refetch && typeof refetch === "function") {
      refetch();
    }
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 2,
          }}
        >
          <Box>
            <Typography variant="h6">
              {showForm
                ? "Хэмжилт засах"
                : `Хэмжилтүүд (${datas?.length || 0})`}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {showForm && (
              <IconButton onClick={handleFormClose}>
                <Iconify icon="eva:arrow-back-fill" />
              </IconButton>
            )}
            <IconButton onClick={handleClose}>
              <Iconify icon="mingcute:close-line" />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent>
          {showForm ? (
            <Box sx={{ py: 1 }}>
              <MeasurementNewEditForm
                currentMeasurement={editingMeasurement}
                onCloseForm={handleFormClose}
                refetch={handleFormRefetch}
                projectId={editingMeasurement?.projectId}
              />
            </Box>
          ) : (
            <>
              {datas && datas.length > 0 ? (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isAllSelected}
                          indeterminate={isIndeterminate}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>№</TableCell>
                      <TableCell>Огноо</TableCell>
                      <TableCell>Систем</TableCell>
                      <TableCell>Сүлжээ</TableCell>
                      <TableCell>Өндөр</TableCell>
                      <TableCell>Харьцангуй таталцал</TableCell>
                      <TableCell>Абсолют таталцал</TableCell>
                      <TableCell align="center">Үйлдэл</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {datas.map((child, index) => {
                      const master = index === 0;
                      return (
                        <TableRow
                          key={child.id}
                          selected={selectedItems.includes(child.id)}
                          hover
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedItems.includes(child.id)}
                              onChange={(e) =>
                                handleSelectItem(child.id, e.target.checked)
                              }
                            />
                          </TableCell>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{child.measured_date || "-"}</TableCell>
                          <TableCell>
                            <ListItemText
                              primary={
                                child.system?.name || child.system || "-"
                              }
                              secondary={
                                child.system?.desc
                                  ? `epoch: ${child.system.desc}`
                                  : "-"
                              }
                              secondaryTypographyProps={{
                                component: "span",
                                color: "text.disabled",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <ListItemText
                              primary={
                                child.network?.name || child.network || "-"
                              }
                              secondary={child.network?.parent?.name || "-"}
                              secondaryTypographyProps={{
                                component: "span",
                                color: "text.disabled",
                              }}
                            />
                          </TableCell>
                          <TableCell>{child.horht || "-"}</TableCell>
                          <TableCell>{child.relative_gravity || "-"}</TableCell>
                          <TableCell>{child.absolute_gravity || "-"}</TableCell>
                          <TableCell align="right" sx={{ px: 1 }}>
                            <IconButton
                              color={childPopover.open ? "inherit" : "default"}
                              onClick={(event) => {
                                setCurrentChild(child);
                                childPopover.onOpen(event);
                              }}
                            >
                              <Iconify icon="eva:more-vertical-fill" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <Box sx={{ p: 3, textAlign: "center" }}>
                  <Typography color="text.secondary">
                    Дэд хэмжилт байхгүй
                  </Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, pt: 0 }}>
          {!showForm && (
            <Stack direction="row" spacing={2} sx={{ flex: 1 }}>
              {selectedItems.length > 0 && (
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleBulkAddToCart}
                    disabled={isProcessing}
                    startIcon={<Iconify icon="solar:cart-bold" />}
                  >
                    {isProcessing ? "Нэмж байна..." : "Сагсанд нэмэх"}
                  </Button>
                  <Typography variant="body2" sx={{ alignSelf: "center" }}>
                    {selectedItems.length} сонгосон
                  </Typography>
                </Stack>
              )}
            </Stack>
          )}
          <Button onClick={handleClose}>Хаах</Button>
        </DialogActions>
      </Dialog>

      <CustomPopover
        open={childPopover.open}
        onClose={childPopover.onClose}
        arrow="right-top"
        sx={{ width: 200 }}
      >
        {!isGrav(currentChild?.network) && (
          <MenuItem
            onClick={() => {
              if (currentChild) {
                handleAddToCartRow(currentChild);
              }
              childPopover.onClose();
            }}
          >
            <Iconify icon="solar:cart-bold" />
            Сагслах
          </MenuItem>
        )}
        {menuPermissions?.update && (
          <MenuItem onClick={() => handleEdit(currentChild)}>
            <Iconify icon="solar:pen-bold" />
            Засах
          </MenuItem>
        )}
        {menuPermissions?.copy && (
          <MenuItem onClick={() => handleEdit(currentChild)}>
            <Iconify icon="mdi:content-copy" />
            Хуулах
          </MenuItem>
        )}
        <Divider sx={{ borderStyle: "dashed" }} />
        {menuPermissions?.delete &&
          (currentChild?.id === main?.id ? (
            <Tooltip title="Үндсэн хэмжилтийг устгах боломжгүй.">
              <span>
                <MenuItem
                  onClick={() => handleDelete(currentChild)}
                  sx={{ color: "error.main" }}
                  disabled={true}
                >
                  <Iconify icon="solar:trash-bin-trash-bold" />
                  Устгах
                </MenuItem>
              </span>
            </Tooltip>
          ) : (
            <MenuItem
              onClick={() => handleDelete(currentChild)}
              sx={{ color: "error.main" }}
            >
              <Iconify icon="solar:trash-bin-trash-bold" />
              Устгах
            </MenuItem>
          ))}
      </CustomPopover>
    </>
  );
}

MeasurementChildrenDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.array,
  menuPermissions: PropTypes.object,
  onAddToCart: PropTypes.func,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  main: PropTypes.object,
  refetch: PropTypes.func,
};
