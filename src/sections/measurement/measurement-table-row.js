import PropTypes from "prop-types";
import TableRow from "@mui/material/TableRow";
import {
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Link,
  ListItemText,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import TableCell from "@mui/material/TableCell";
import { RouterLink } from "src/routes/components";
import Image from "src/components/image";
import { useBoolean } from "src/hooks/use-boolean";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import MeasurementNewEditForm from "./measurement-new-edit-form";
import MeasurementChildrenDialog from "./measurement-children-dialog";
import { useState } from "react";
import ProfileAvatar from "src/components/profile-avatar";

export default function MeasurementTableRow({
  row,
  rowQueue,
  onDeleteRow,
  addToCartRow,
  menuPermissions,
  tableHeadLength,
  refetch,
  projectId,
}) {
  const form = useBoolean();
  const confirm = useBoolean();
  const childrenDialog = useBoolean();
  const popover = usePopover();
  const { page, rowsPerPage, index } = rowQueue;
  const {
    point,
    system,
    network,
    measured_date,
    journal_engineer,
    passport_engineer,
  } = row;
  const [adding, setAdding] = useState(false);
  const [duplicateData, setDuplicateData] = useState(null);
  const [showNewMeasurementForm, setShowNewMeasurementForm] = useState(false);
  const { status, thumb } = point;
  const name = point?.name || row?.name || "N/A";
  const number = point?.number || row?.number || "N/A";
  const linkTo = point?.id ? `/dashboard/ready/${point.id}` : "#";

  const handleDuplicate = () => {
    setDuplicateData({
      point: row?.point,
      system: row?.system,
      network: row?.network,
      projectId: row?.projectId,
      line: row?.line,
      description: "",
      horht: row?.horht,
      is_new: row?.is_new,
      deviceId: row?.deviceId,
      journal_engineer: row?.journal_engineer,
      passport_engineer: row?.passport_engineer,
    });
    form.onTrue();
    popover.onClose();
  };

  const handleAddNewMeasurement = () => {
    setShowNewMeasurementForm(true);
    popover.onClose();
  };

  return (
    <>
      <TableRow>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell>
          <Stack direction="row" spacing={2} alignItems="center">
            <Image
              alt={name}
              src={`${process.env.NEXT_PUBLIC_HOST_API}${thumb}`}
              sx={{ borderRadius: 1, height: 96, width: 96, flexShrink: 0 }}
            />
            <ListItemText
              primary={
                <Link
                  component={RouterLink}
                  href={linkTo}
                  color="inherit"
                  variant="subtitle2"
                  noWrap
                >
                  {name}
                </Link>
              }
              secondary={
                <>
                  <Typography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                    noWrap
                  >
                    № {number}
                  </Typography>
                  <Typography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                    noWrap
                    sx={{ display: "block" }} // дараагийн мөрөнд гаргах
                  >
                    <Chip
                      label={status?.name}
                      size="small"
                      color="success"
                    ></Chip>
                  </Typography>
                </>
              }
              secondaryTypographyProps={{
                component: "span",
                color: "text.secondary",
                noWrap: true,
              }}
            />
          </Stack>
        </TableCell>

        <TableCell>
          <Box sx={{}}>
            <ListItemText
              primary={network?.name || "-"}
              primaryTypographyProps={{ textAlign: "center" }}
              secondary={`${network?.parent?.name || "-"}`}
              secondaryTypographyProps={{
                component: "span",
                color: "text.disabled",
                textAlign: "center",
              }}
            />
          </Box>
          {row?.children && row.children.length > 0 && (
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Button
                variant="outlined"
                size="small"
                color="primary"
                onClick={childrenDialog.onTrue}
                sx={{
                  minWidth: "auto",
                  px: 1,
                  py: 0.5,
                  fontSize: "0.75rem",
                }}
                startIcon={<Iconify icon="eva:eye-outline" />}
              >
                +{row.children.length}
              </Button>
            </Box>
          )}
        </TableCell>
        <TableCell>
          <ListItemText
            primary={system?.name || "-"}
            secondary={`epoch:${system?.desc || "-"}`}
            secondaryTypographyProps={{
              component: "span",
              color: "text.disabled",
            }}
          />
        </TableCell>
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={2}>
            <ProfileAvatar user={journal_engineer} />
            <Typography variant="body2">
              {journal_engineer?.full_name}
              <Typography variant="body2">{measured_date}</Typography>
            </Typography>
          </Stack>
        </TableCell>

        <TableCell align="right" sx={{ px: 1 }}>
          <IconButton
            color={popover.open ? "inherit" : "default"}
            onClick={popover.onOpen}
            id={`measurement-edit-${index}`}
          >
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell
          style={{ paddingBottom: 0, paddingTop: 0 }}
          colSpan={tableHeadLength}
        >
          <Collapse in={form.value} timeout="auto" unmountOnExit>
            <Box sx={{ px: 1, py: 2 }}>
              <MeasurementNewEditForm
                currentMeasurement={duplicateData ? null : row}
                duplicateData={duplicateData}
                onCloseForm={() => {
                  setDuplicateData(null);
                  form.onFalse();
                }}
                refetch={refetch}
                projectId={projectId}
              />
            </Box>
          </Collapse>
          <Collapse in={showNewMeasurementForm} timeout="auto" unmountOnExit>
            <Box sx={{ px: 1, py: 2 }}>
              <MeasurementNewEditForm
                currentMeasurement={null}
                onCloseForm={() => {
                  setShowNewMeasurementForm(false);
                }}
                refetch={refetch}
                pointId={row?.point?.id}
                projectId={projectId}
                parent={row?.id}
              />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 200 }}
      >
        <MenuItem onClick={addToCartRow} disabled={adding}>
          <Iconify icon="solar:cart-bold" />
          Сагслах
        </MenuItem>
        {menuPermissions?.update && (
          <MenuItem
            onClick={() => {
              form.onToggle();
              popover.onClose();
            }}
          >
            <Iconify icon="solar:pen-bold" />
            Засах
          </MenuItem>
        )}
        {menuPermissions?.copy && (
          <MenuItem onClick={handleDuplicate}>
            <Iconify icon="mdi:content-copy" />
            Хуулах
          </MenuItem>
        )}
        <Divider sx={{ borderStyle: "dashed" }} />
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
        content={
          <>
            Та <strong>{name}</strong> хэмжилтийг устгахдаа итгэлтэй байна уу?
          </>
        }
        action={
          <Button variant="contained" color="error" onClick={onDeleteRow}>
            Устгах
          </Button>
        }
      />

      <MeasurementChildrenDialog
        open={childrenDialog.value}
        onClose={childrenDialog.onFalse}
        children={row?.children}
        menuPermissions={menuPermissions}
        main={row}
        refetch={refetch}
        parent={row?.id}
      />
    </>
  );
}

MeasurementTableRow.propTypes = {
  row: PropTypes.object,
  rowQueue: PropTypes.object,
  menuPermissions: PropTypes.object,
  refetch: PropTypes.func,
  onDeleteRow: PropTypes.func,
  tableHeadLength: PropTypes.number,
  projectId: PropTypes.number,
  addToCartRow: PropTypes.func,
};
