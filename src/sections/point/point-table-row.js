import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import { paths } from "src/routes/paths";
import { RouterLink } from "src/routes/components";
import {
  Button,
  Checkbox,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import { useBoolean } from "src/hooks/use-boolean";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import dayjs from "dayjs";

// ----------------------------------------------------------------------

export default function PointTableRow({
  currentPoint,
  rowQueue,
  menuPermissions,
  refetch,
  onDeleteRow,
  handleAddToCartRow,
  selected,
  onSelectRow,
}) {
  const { page, rowsPerPage, index } = rowQueue;
  const {
    id,
    name,
    number,
    nomek100,
    unit,
    measurements__measured_date,
    measurements,
  } = currentPoint;
  const confirm = useBoolean();
  const popover = usePopover();
  const measurementPopover = usePopover();
  const linkTo = paths.dashboard.point.details(id);

  const otherMeasurements = Array.isArray(measurements)
    ? measurements.filter((m) => !m?.is_new)
    : [];

  return (
    <>
      <TableRow hover selected={selected} sx={{ "& td": { py: 0.75 } }}>
        <TableCell padding="checkbox">
          <Checkbox checked={selected} onClick={onSelectRow} />
        </TableCell>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell>
          <Link
            component={RouterLink}
            href={linkTo}
            color="primary"
            variant="subtitle2"
            underline="none"
            noWrap
            id={`service-detail-${index}`}
            sx={{ display: "block", lineHeight: 1.3 }}
          >
            {name}
          </Link>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ display: "block", lineHeight: 1.2 }}
          >
            № {number}
          </Typography>
        </TableCell>
        <TableCell>{measurements__measured_date}</TableCell>
        <TableCell>
          {Array.isArray(measurements) && measurements.length ? (
            (() => {
              const primary = measurements[0];
              const primaryNetwork =
                typeof primary?.network === "object"
                  ? primary?.network?.name
                  : primary?.network;
              const others = measurements.length - 1;

              return (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" noWrap>
                    {primaryNetwork || "-"}
                  </Typography>

                  {others > 0 && (
                    <Button
                      variant="outlined"
                      size="small"
                      color="primary"
                      onClick={measurementPopover.onOpen}
                      sx={{
                        minWidth: "auto",
                        px: 1,
                        py: 0,
                        fontSize: "0.75rem",
                      }}
                      startIcon={<Iconify icon="eva:eye-outline" />}
                    >
                      +{others}
                    </Button>
                  )}
                </Box>
              );
            })()
          ) : (
            <Typography variant="body2" color="text.disabled">
              -
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <Typography
            variant="body2"
            noWrap
            sx={{ display: "block", lineHeight: 1.3 }}
          >
            {unit.primary}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ display: "block", lineHeight: 1.2 }}
          >
            {unit.secondary}
          </Typography>
        </TableCell>
        <TableCell>{nomek100}</TableCell>
        <TableCell align="right" sx={{ px: 1 }}>
          <IconButton
            color={popover.open ? "inherit" : "default"}
            onClick={popover.onOpen}
            id={`service-delete-${index}`}
          >
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 200 }}
      >
        <MenuItem
          onClick={() => {
            if (measurements?.length > 0) {
              handleAddToCartRow(measurements[0]);
            }
            popover.onClose();
          }}
        >
          <Iconify icon="solar:cart-bold" />
          Сагслах
        </MenuItem>
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

      <CustomPopover
        open={measurementPopover.open}
        onClose={measurementPopover.onClose}
        arrow="bottom-left"
        sx={{ p: 1, maxWidth: 320 }}
      >
        <Typography
          variant="subtitle2"
          sx={{ mb: 0.5, px: 0.5 }}
          color="text.secondary"
        >
          Бусад хэмжилтүүд
        </Typography>
        <List dense disablePadding>
          {otherMeasurements.map((m, i) => {
            const networkName =
              typeof m?.network === "object" ? m?.network?.name : m?.network;
            const dateStr = m?.measured_date
              ? dayjs(m.measured_date).format("YYYY-MM-DD")
              : "-";
            return (
              <ListItem
                key={m?.id ?? i}
                disableGutters
                sx={{ py: 0.25, px: 0.5 }}
              >
                <ListItemText
                  primary={`${networkName || "-"}`}
                  secondary={dateStr}
                  primaryTypographyProps={{ variant: "body2" }}
                  secondaryTypographyProps={{
                    variant: "caption",
                    color: "text.secondary",
                  }}
                />
              </ListItem>
            );
          })}
        </List>
      </CustomPopover>

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Устгах"
        content={
          <>
            Та <strong>{name}</strong> гэсэн нэртэй тогтмолыг устгахдаа итгэлтэй
            байна уу?
          </>
        }
        action={
          <Button variant="contained" color="error" onClick={onDeleteRow}>
            Устгах
          </Button>
        }
      />
    </>
  );
}

PointTableRow.propTypes = {
  currentPoint: PropTypes.object,
  rowQueue: PropTypes.object,
  menuPermissions: PropTypes.array,
  refetch: PropTypes.func,
  onDeleteRow: PropTypes.func,
  handleAddToCartRow: PropTypes.func,
  selected: PropTypes.bool,
  onSelectRow: PropTypes.func,
};
