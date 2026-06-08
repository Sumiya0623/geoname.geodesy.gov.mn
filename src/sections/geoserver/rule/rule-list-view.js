"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Card,
  Box,
  Grid,
  Typography,
  Chip,
  IconButton,
  Button,
  Divider,
  Skeleton,
  Stack,
  Paper,
  alpha,
  useTheme,
  Fade,
  Zoom,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";
import { useBoolean } from "src/hooks/use-boolean";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import { useSnackbar } from "src/components/snackbar";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";

import RuleNewEditForm from "./rule-new-edit-form";
import PropTypes from "prop-types";
import { useGetLayer, useGetRules } from "src/api/map";
import { getAxiosErrorMessage } from "src/utils/error-snack";

import { Close as CloseIcon } from "@mui/icons-material";
import axiosInstance, { endpoints } from "src/utils/axios";

const OP_LABELS = {
  eq: "=",
  neq: "≠",
  lt: "<",
  lte: "≤",
  gt: ">",
  gte: "≥",
  contains: "contains",
  startsWith: "startsWith",
  endsWith: "endsWith",
  between: "between",
  in: "in",
  isnull: "IS NULL",
  isnotnull: "IS NOT NULL",
};

const defaultFilters = {};
function RuleCard({ layerId, rule, index, onEdit, onDelete, menuPermissions }) {
  const theme = useTheme();
  const popover = usePopover();
  const confirm = useBoolean();

  const { id, name, filters, fill_color, size, symbolizer, icon } = rule;

  const handleEdit = () => {
    onEdit();
    popover.onClose();
  };

  const handleDelete = () => {
    confirm.onTrue();
    popover.onClose();
  };

  return (
    <Zoom
      in
      timeout={200 + index * 100}
      style={{ transitionDelay: `${index * 50}ms` }}
    >
      <Card
        sx={{
          p: 3,
          position: "relative",
          cursor: "pointer",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          transformOrigin: "center",
          "&:hover": {
            transform: "translateY(-8px) scale(1.02)",
            boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
            "& .rule-actions": {
              opacity: 1,
              transform: "scale(1.1)",
            },
          },
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.primary.main, 0.03)} 100%)`,
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          },
        }}
      >
        {/* Rule Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          mb={2}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              className="rule-number"
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                fontSize: "0.875rem",
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
              }}
            >
              {index + 1}
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: theme.palette.text.primary }}
              >
                {name || ``}
              </Typography>
            </Box>
          </Stack>

          <IconButton
            className="rule-actions"
            onClick={popover.onOpen}
            sx={{
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              // backgroundColor: alpha(theme.palette.background.paper, 0.8),
              // backdropFilter: "blur(8px)",
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              "&:hover": {
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                borderColor: theme.palette.primary.main,
              },
            }}
          >
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </Stack>

        {/* Rule Content */}
        <Stack spacing={2}>
          {/* Filters */}
          {filters && filters.length > 0 && (
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Filters:
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {filters.map((filter, idx) => (
                  <Chip
                    key={idx}
                    label={`${filter.field} ${OP_LABELS[filter.operator] || filter.operator} ${filter.value}`}
                    size="small"
                    variant="outlined"
                    sx={{
                      backgroundColor: alpha(theme.palette.info.main, 0.1),
                      borderColor: alpha(theme.palette.info.main, 0.2),
                      color: theme.palette.info.main,
                      transition: "all 0.2s ease-in-out",
                      "&:hover": {
                        backgroundColor: alpha(theme.palette.info.main, 0.2),
                        transform: "scale(1.05)",
                      },
                    }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* Visual Properties */}
          <Grid container spacing={2}>
            {fill_color && (
              <Grid item xs={6} sm={3}>
                <Paper
                  sx={{
                    p: 1.5,
                    textAlign: "center",
                    backgroundColor: alpha(
                      theme.palette.background.neutral,
                      0.5
                    ),
                  }}
                >
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: "4px",
                      backgroundColor: fill_color,
                      border: `1px solid ${theme.palette.divider}`,
                      mx: "auto",
                      mb: 0.5,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Color
                  </Typography>
                </Paper>
              </Grid>
            )}

            {size && (
              <Grid item xs={6} sm={3}>
                <Paper
                  sx={{
                    p: 1.5,
                    textAlign: "center",
                    backgroundColor: alpha(
                      theme.palette.background.neutral,
                      0.5
                    ),
                  }}
                >
                  <Typography variant="body2" fontWeight="600">
                    {size}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Size
                  </Typography>
                </Paper>
              </Grid>
            )}

            {icon && (
              <Grid item xs={6} sm={3}>
                <Paper
                  sx={{
                    p: 1.5,
                    textAlign: "center",
                    backgroundColor: alpha(
                      theme.palette.background.neutral,
                      0.5
                    ),
                  }}
                >
                  <Iconify icon={icon} width={24} />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                  >
                    Icon
                  </Typography>
                </Paper>
              </Grid>
            )}

            {symbolizer && (
              <Grid item xs={6} sm={3}>
                <Paper
                  sx={{
                    p: 1.5,
                    textAlign: "center",
                    backgroundColor: alpha(
                      theme.palette.background.neutral,
                      0.5
                    ),
                  }}
                >
                  <Typography variant="body2" fontWeight="600">
                    {symbolizer}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Type
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Stack>

        {/* Popover Menu */}
        <CustomPopover
          open={popover.open}
          onClose={popover.onClose}
          arrow="right-top"
          sx={{ width: 200 }}
        >
          {menuPermissions?.update && (
            <MenuItem onClick={handleEdit}>
              <Iconify icon="solar:pen-bold" />
              Засах
            </MenuItem>
          )}
          <Divider sx={{ borderStyle: "dashed" }} />
          {menuPermissions?.delete && (
            <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
              <Iconify icon="solar:trash-bin-trash-bold" />
              Устгах
            </MenuItem>
          )}
        </CustomPopover>

        {/* Confirm Dialog */}
        <ConfirmDialog
          open={confirm.value}
          onClose={confirm.onFalse}
          title="Устгах"
          content={
            <>
              Та <strong>{name || `Rule ${id}`}</strong> дүрмийг устгахдаа
              итгэлтэй байна уу?
            </>
          }
          action={
            <Button variant="contained" color="error" onClick={onDelete}>
              Устгах
            </Button>
          }
        />
      </Card>
    </Zoom>
  );
}

RuleCard.propTypes = {
  rule: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  menuPermissions: PropTypes.object,
};

export default function RuleListView({ layerId, onClose }) {
  const theme = useTheme();
  const form = useBoolean();
  const { enqueueSnackbar } = useSnackbar();
  const menuPermissions = useMenuPermissions({ content: "stylerule" });
  const [filters, setFilters] = useState(defaultFilters);
  const [editingRule, setEditingRule] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12); // More cards per page
  const { layer } = useGetLayer(layerId);
  const requestBody = useMemo(
    () => ({
      page: page + 1,
      page_size: rowsPerPage,
      ordering: "-id", // Default ordering
      layer: layer?.id || "",
      ...filters,
    }),
    [filters, page, rowsPerPage, layer]
  );

  const { rules, rulesEmpty, rulesMutation, rulesLoading, rulesCount } =
    useGetRules(requestBody);

  const handleDeleteRule = useCallback(
    async (id) => {
      try {
        const response = await axiosInstance.delete(
          endpoints.geoserver.style.rule.delete(id)
        );
        if (response?.status === 204) {
          rulesMutation();
          enqueueSnackbar(`Дүрмийг амжилттай устгагдлаа`, {
            variant: "success",
          });
        }
      } catch (error) {
        enqueueSnackbar(getAxiosErrorMessage(error), {
          variant: "warning",
        });
      }
    },
    [rulesMutation, enqueueSnackbar]
  );

  const handleEditRule = (rule) => {
    setEditingRule(rule);
  };

  const handleCloseEdit = () => {
    setEditingRule(null);
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  // Render skeleton cards for loading state
  const renderSkeletonCards = Array.from({ length: rowsPerPage }).map(
    (_, index) => (
      <Grid item xs={12} sm={6} md={4} key={index}>
        <Card sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Skeleton variant="circular" width={40} height={40} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="text" width="40%" height={16} />
              </Box>
            </Stack>
            <Stack spacing={1}>
              <Skeleton variant="text" width="30%" height={16} />
              <Stack direction="row" gap={1}>
                <Skeleton variant="rounded" width={80} height={24} />
                <Skeleton variant="rounded" width={100} height={24} />
              </Stack>
            </Stack>
            <Grid container spacing={2}>
              {[1, 2, 3].map((item) => (
                <Grid item xs={4} key={item}>
                  <Skeleton variant="rounded" height={60} />
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Card>
      </Grid>
    )
  );

  // Render rule cards
  const renderRuleCards = rules?.map((rule, index) => (
    <Grid item xs={12} sm={6} md={4} key={rule.id}>
      <RuleCard
        rule={rule}
        index={index}
        onEdit={() => handleEditRule(rule)}
        onDelete={() => handleDeleteRule(rule.id)}
        menuPermissions={menuPermissions}
      />
    </Grid>
  ));

  // Render empty state
  const renderEmptyState = (
    <Grid item xs={12}>
      <Paper
        sx={{
          p: 6,
          textAlign: "center",
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
          border: `2px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
        }}
      >
        <Iconify
          icon="solar:document-add-bold-duotone"
          width={64}
          sx={{ color: "text.disabled", mb: 2 }}
        />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Илэрц олдсонгүй
        </Typography>
      </Paper>
    </Grid>
  );

  return (
    <Fade in timeout={300}>
      <Box>
        {menuPermissions?.create && (
          <Box display="flex" justifyContent="flex-end">
            <Button
              variant="contained"
              size="small"
              color="primary"
              sx={{ mb: 2 }}
              onClick={form.onToggle}
            >
              Нэмэх
            </Button>
          </Box>
        )}

        <Dialog
          open={form.value}
          onClose={form.onFalse}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 2 },
          }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 2,
              transition: 0.4,
              bgcolor: "primary.main",
              color: "white",
            }}
          >
            <Typography variant="h6" component="div">
              Style нэмэх
            </Typography>

            <IconButton
              size="small"
              onClick={form.onFalse}
              sx={{
                color: "white",
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.1)",
                  transform: "scale(1.1)",
                },
                transition: "all 0.2s ease",
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <RuleNewEditForm
              onCloseForm={form.onFalse}
              refetch={rulesMutation}
              layer={layer}
            />
          </DialogContent>
        </Dialog>

        {/* Rules Grid */}
        <Grid container spacing={2}>
          {rulesLoading && renderSkeletonCards}
          {!rulesLoading && rules?.length > 0 && renderRuleCards}
          {!rulesLoading && rulesEmpty && renderEmptyState}
        </Grid>

        {/* Pagination */}
        {rulesCount > 0 && (
          <Card sx={{ mt: 3, p: 2 }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="body2" color="text.secondary">
                Showing {Math.min(page * rowsPerPage + 1, rulesCount)}-
                {Math.min((page + 1) * rowsPerPage, rulesCount)} of {rulesCount}{" "}
                rules
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                <IconButton
                  onClick={(e) => handlePageChange(e, page - 1)}
                  disabled={page === 0}
                  size="small"
                >
                  <Iconify icon="eva:arrow-ios-back-fill" />
                </IconButton>
                <Typography
                  variant="body2"
                  sx={{ minWidth: 40, textAlign: "center" }}
                >
                  {page + 1}
                </Typography>
                <IconButton
                  onClick={(e) => handlePageChange(e, page + 1)}
                  disabled={page >= Math.ceil(rulesCount / rowsPerPage) - 1}
                  size="small"
                >
                  <Iconify icon="eva:arrow-ios-forward-fill" />
                </IconButton>
              </Stack>
            </Stack>
          </Card>
        )}

        {/* Edit Dialog */}
        <Dialog
          open={!!editingRule}
          onClose={handleCloseEdit}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 2 },
          }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 2,
              transition: 0.4,
              bgcolor: "primary.main",
              color: "white",
            }}
          >
            <Typography variant="h6" component="div">
              {editingRule?.name || `Rule ${editingRule?.id}`}
            </Typography>
            <IconButton
              size="small"
              onClick={handleCloseEdit}
              sx={{
                color: "white",
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.1)",
                  transform: "scale(1.1)",
                },
                transition: "all 0.2s ease",
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {editingRule && (
              <RuleNewEditForm
                currentRule={editingRule}
                onCloseForm={handleCloseEdit}
                refetch={rulesMutation}
                layer={layer}
              />
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </Fade>
  );
}

RuleListView.propTypes = {
  layerId: PropTypes.number,
  onClose: PropTypes.func,
};
