import PropTypes from "prop-types";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import MenuItem from "@mui/material/MenuItem";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import IconButton from "@mui/material/IconButton";
import ListItemText from "@mui/material/ListItemText";

import { useBoolean } from "src/hooks/use-boolean";

import { formatMNT } from "src/utils/format-number";
import { fTime } from "src/utils/format-time";

import Label from "src/components/label";
import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import { useCallback, useState } from "react";
import { enqueueSnackbar } from "notistack";
import axiosInstance, { endpoints } from "src/utils/axios";
import { LoadingButton } from "@mui/lab";
import OrderDialog from "./order-dialog";
import { Badge, Divider, Typography } from "@mui/material";
import ProfileAvatar from "src/components/profile-avatar";

// ----------------------------------------------------------------------

export default function OrderTableRow({
  row,
  selected,
  rowQueue,
  onDeleteRow,
  refetch,
  menuPermissions,
}) {
  const { page, rowsPerPage, index } = rowQueue;
  const {
    id,
    user,
    items,
    status,
    created_date,
    subtotal,
    catalogy,
    ...other
  } = row;
  const confirm = useBoolean();
  const popover = usePopover();
  const itemsPopover = usePopover();
  const [itemsPage, setItemsPage] = useState(0);
  const ITEMS_PER_PAGE = 5;

  const [deletingId, setDeletingId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    try {
      setDownloading(true);
      const res = await axiosInstance.post(
        endpoints.order.download(id),
        {},
        { responseType: "blob" }
      );
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date()
        .toISOString()
        .replace(/[-:T]/g, "")
        .slice(0, 14);
      a.href = url;
      a.download = `catalogy_${id}_${stamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      enqueueSnackbar(e?.message || "PDF татах үед алдаа гарлаа", {
        variant: "error",
      });
    } finally {
      setDownloading(false);
    }
  }, [id]);

  const handleOpenDialog = useCallback((item) => {
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleDeleteRow = useCallback(
    async (itemId) => {
      try {
        setDeletingId(itemId);
        const res = await axiosInstance.post(endpoints.order.remove, {
          item_id: itemId,
        });
        if (res?.status === 200) {
          refetch?.();
          enqueueSnackbar("Цэгийн захиалга амжилттай устгагдлаа");
        }
      } catch (e) {
        enqueueSnackbar(
          e?.message || "Цэгийн захиалга устгах үед алдаа гарлаа",
          {
            variant: e?.message ? "warning" : "error",
          }
        );
      } finally {
        setDeletingId(null);
      }
    },
    [refetch]
  );

  const renderPrimary = (
    <TableRow hover selected={selected}>
      <TableCell>{page * rowsPerPage + index + 1}</TableCell>
      <TableCell sx={{ display: "flex", alignItems: "center" }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <ProfileAvatar user={user} sx={{ mr: 2 }} />
          <Typography variant="body2">{user?.full_name}</Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <IconButton
          onClick={itemsPopover.onOpen}
          color={itemsPopover.open ? "inherit" : "default"}
          id={`order-exp-${index}`}
          size="small"
          sx={{
            p: 0.5,
            borderRadius: 1,
            ...(itemsPopover.open && { bgcolor: "action.hover" }),
          }}
        >
          <Badge
            badgeContent={items.length}
            color="primary"
            max={999}
            showZero
            overlap="circular"
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1,
                bgcolor: "action.selected",
                display: "grid",
                placeItems: "center",
                transition: "transform .2s",
              }}
            >
              <Iconify icon="solar:cart-3-bold" width={20} />
            </Box>
          </Badge>
        </IconButton>
      </TableCell>

      <TableCell> {formatMNT(subtotal)} </TableCell>
      <TableCell>
        <Box id={`order-download-${index}`}>
          {row.is_paid ? (
            <LoadingButton
              loading={downloading}
              onClick={handleDownload}
              variant="soft"
              color="info"
              size="small"
              startIcon={<Iconify icon="mdi:download" width={16} />}
              sx={{
                borderRadius: 1,
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              PDF татах
            </LoadingButton>
          ) : (
            <Label variant="soft" color="warning">
              Хүлээгдэж буй
            </Label>
          )}
        </Box>
      </TableCell>

      <TableCell>
        <ListItemText
          primary={created_date}
          secondary={fTime(created_date)}
          primaryTypographyProps={{ typography: "body2", noWrap: true }}
          secondaryTypographyProps={{
            mt: 0.5,
            component: "span",
            typography: "caption",
          }}
        />
      </TableCell>

      <TableCell align="right" sx={{ px: 1, whiteSpace: "nowrap" }}>
        <IconButton
          color={popover.open ? "inherit" : "default"}
          onClick={popover.onOpen}
          id={`order-edit-${index}`}
        >
          <Iconify icon="eva:more-vertical-fill" />
        </IconButton>
      </TableCell>
    </TableRow>
  );

  return (
    <>
      {renderPrimary}
      <CustomPopover
        open={itemsPopover.open}
        onClose={itemsPopover.onClose}
        arrow="right-top"
        sx={{ width: 360, p: 1 }}
      >
        {(() => {
          const totalPages = Math.max(
            1,
            Math.ceil(items.length / ITEMS_PER_PAGE)
          );
          const safePage = Math.min(itemsPage, totalPages - 1);
          const start = safePage * ITEMS_PER_PAGE;
          const currentItems = items.slice(start, start + ITEMS_PER_PAGE);

          return (
            <Stack spacing={1}>
              <Typography variant="subtitle2">Сагсан дахь цэгүүд</Typography>
              <Divider sx={{ borderStyle: "dashed" }} />
              {currentItems.map((item) => (
                <Stack
                  key={item.id}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                >
                  <Avatar
                    src={
                      item?.point?.thumb?.startsWith("http")
                        ? item.point.thumb
                        : `${process.env.NEXT_PUBLIC_HOST_API}${
                            item?.point?.thumb || ""
                          }`
                    }
                    variant="rounded"
                    sx={{ width: 40, height: 40 }}
                  />
                  <Box
                    sx={{
                      flexGrow: 1,
                      overflow: 'hidden'
                    }}
                    title={item?.point?.name || ''}
                  >
                    <Typography variant="body2" noWrap>
                      {item?.point?.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {item?.point?.number}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ mr: 1 }}>
                    {formatMNT(item?.unit_price)}
                  </Typography>
                  {!row.is_paid &&
                    <LoadingButton
                      size="small"
                      color="error"
                      variant="text"
                      loading={deletingId === item.id}
                      onClick={() => handleDeleteRow(item.id)}
                      sx={{
                        minWidth: 32,
                        width: 32,
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        p: 0,
                      }}
                    >
                      <Iconify
                        icon="solar:trash-bin-trash-bold"
                        width={16}
                        height={16}
                      />
                    </LoadingButton>
                  }
                </Stack>
              ))}

              {items.length > ITEMS_PER_PAGE && (
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ pt: 0.5 }}
                >
                  <Button
                    size="small"
                    onClick={() => setItemsPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                  >
                    Өмнөх
                  </Button>
                  <Typography variant="caption">
                    {safePage + 1} / {totalPages}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() =>
                      setItemsPage((p) => (p + 1 < totalPages ? p + 1 : p))
                    }
                    disabled={safePage + 1 >= totalPages}
                  >
                    Дараах
                  </Button>
                </Stack>
              )}

              {!row.is_paid && items?.length > 0 && (
                <Box sx={{ pt: 1, textAlign: "right" }}>
                  <Button
                    onClick={() => {
                      handleOpenDialog(row);
                      itemsPopover.onClose();
                    }}
                    size="small"
                    variant="outlined"
                    sx={{ color: "success.main", backgroundColor: "white" }}
                  >
                    <Iconify icon="mdi-light:cart" />
                    Төлөх
                  </Button>
                </Box>
              )}
            </Stack>
          );
        })()}
      </CustomPopover>
      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 140 }}
      >
        {!row.is_paid && (
          <MenuItem
            onClick={() => handleOpenDialog(row)}
            sx={{ color: "success.main" }}
          >
            <Iconify icon="mdi-light:cart" />
            Төлөх
          </MenuItem>
        )}
        {menuPermissions?.delete && (
          <MenuItem
            onClick={() => {
              confirm.onTrue();
              popover.onClose();
            }}
            sx={{ color: "error.main" }}
          >
            <Iconify icon="solar:trash-bin-trash-bold" />
            Устгах
          </MenuItem>
        )}
      </CustomPopover>

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Устгах"
        content="Та устгахдаа итгэлтэй байна уу?"
        action={
          <Button variant="contained" color="error" onClick={onDeleteRow}>
            Устгах
          </Button>
        }
      />
      <OrderDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        item={row}
        refetch={refetch}
      />
    </>
  );
}

OrderTableRow.propTypes = {
  row: PropTypes.object,
  selected: PropTypes.bool,
  onViewRow: PropTypes.func,
  onDeleteRow: PropTypes.func,
  onSelectRow: PropTypes.func,
};
