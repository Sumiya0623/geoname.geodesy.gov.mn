"use client";

import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Card,
  Box,
  Grid,
  Tab,
  Tabs,
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
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

import { useBoolean } from "src/hooks/use-boolean";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import { useSnackbar } from "src/components/snackbar";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";

import axiosInstance, { endpoints } from "src/utils/axios";
import { getAxiosErrorMessage } from "src/utils/error-snack";
import { useGetRules } from "src/api/rule";

import RuleNewEditForm from "./rule-new-edit-form";

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

// Масштабын мужийн шошго/түлхүүр (module‑level — useMemo dep тогтвортой)
const fmtScale = (v) =>
  v ? `1:${Number(v).toLocaleString("en-US").replace(/,/g, "'")}` : null;
const groupLabel = (min, max) => {
  if (!min && !max) return "Бүх масштаб";
  return `${fmtScale(min) || "1:0"} – ${fmtScale(max) || "1:∞"}`;
};
const groupKey = (min, max) => `${min ?? ""}|${max ?? ""}`;

function RuleCard({ rule, index, onEdit, onDelete, menuPermissions }) {
  const theme = useTheme();
  const popover = usePopover();
  const confirm = useBoolean();

  const { id, filters, fill_color, size, symbolizer, icon } = rule;

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
              {rule.order ?? index + 1}
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: theme.palette.text.primary }}
              >
                {`Дүрэм #${id}`}
              </Typography>
            </Box>
          </Stack>

          <IconButton
            className="rule-actions"
            onClick={popover.onOpen}
            sx={{
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={icon}
                    alt="icon"
                    style={{ width: 24, height: 24, objectFit: "contain" }}
                  />
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
              Та <strong>{`Дүрэм #${id}`}</strong> дүрмийг устгахдаа итгэлтэй
              байна уу?
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

export default function RuleListView({ selectedLayerId, onClose }) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  // Эрхийг nameclass‑аас авна (style нь nameclass leaf‑д харьяалагдана) — nameclass
  // засах эрхтэй хэрэглэгч дүрэм нэмэх/засах/устгах товчийг харна.
  const menuPermissions = useMenuPermissions({ content: "nameclass" });
  const [editingRule, setEditingRule] = useState(null);

  const { rules, rulesEmpty, rulesMutation, rulesLoading, rulesCount } =
    useGetRules(selectedLayerId);

  // Дүрэм байхгүй бол GeoServer дээрх одоогийн (default) style‑ийн SLD‑г DB рүү
  // нэг удаа импортлоно — default дүрэм засагчид гарч засагдах болно.
  const importedRef = useRef(null);
  useEffect(() => {
    if (!selectedLayerId || rulesLoading) return;
    if (rules.length > 0) return;
    if (importedRef.current === selectedLayerId) return; // нэг layer‑т нэг л удаа
    importedRef.current = selectedLayerId;
    (async () => {
      try {
        const res = await axiosInstance.post(
          endpoints.geoserver.style.rule.importDefault,
          { layer: selectedLayerId }
        );
        if (res?.data?.imported > 0) {
          await rulesMutation();
          enqueueSnackbar("GeoServer‑ийн default style импортлогдлоо", {
            variant: "success",
          });
        }
      } catch (error) {
        // импорт амжилтгүй бол хоосон жагсаалт хэвээр — алдааг чимээгүй өнгөрүүлнэ
      }
    })();
  }, [selectedLayerId, rulesLoading, rules.length, rulesMutation, enqueueSnackbar]);

  // --- Масштабын мужаар бүлэглэх (таб бүр = нэг scale range) ---
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState("");

  const scaleGroups = useMemo(() => {
    const m = new Map();
    (rules || []).forEach((r) => {
      const k = groupKey(r.min_scale_denom, r.max_scale_denom);
      if (!m.has(k))
        m.set(k, {
          key: k,
          min: r.min_scale_denom,
          max: r.max_scale_denom,
          label: groupLabel(r.min_scale_denom, r.max_scale_denom),
          rules: [],
        });
      m.get(k).rules.push(r);
    });
    // масштабын Min‑ээр эрэмбэлнэ (бүх масштаб эхэнд)
    return Array.from(m.values()).sort(
      (a, b) => (a.min ?? 0) - (b.min ?? 0)
    );
  }, [rules]);

  // Сонгосон таб алга бол эхний бүлгийг идэвхжүүлнэ
  useEffect(() => {
    if (scaleGroups.length && !scaleGroups.find((g) => g.key === activeTab)) {
      setActiveTab(scaleGroups[0].key);
    }
  }, [scaleGroups, activeTab]);

  const activeGroup = scaleGroups.find((g) => g.key === activeTab) || null;

  const handleDeleteRule = useCallback(
    async (id) => {
      try {
        const response = await axiosInstance.delete(
          endpoints.geoserver.style.rule.delete(id)
        );
        if (response?.status === 204 || response?.status === 200) {
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

  // Render skeleton cards for loading state
  const renderSkeletonCards = Array.from({ length: 6 }).map((_, index) => (
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

  const tabValue = adding ? "__add__" : activeTab;

  return (
    <Fade in timeout={300}>
      <Box>
        <Stack sx={{ mb: 1 }}>
          <Typography variant="h6">
            Style дүрмүүд{selectedLayerId ? ` · Layer #${selectedLayerId}` : ""}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Масштабын муж бүр дээр өөр style. Таб сонгож тухайн мужийн дүрмийг засна.
          </Typography>
        </Stack>

        {/* Масштабын мужаар таб (таб бүр = scale range) + Нэмэх */}
        <Tabs
          value={tabValue}
          onChange={(_, v) => {
            if (v === "__add__") {
              setEditingRule(null);
              setAdding(true);
            } else {
              setAdding(false);
              setEditingRule(null);
              setActiveTab(v);
            }
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
        >
          {scaleGroups.map((g) => (
            <Tab
              key={g.key}
              value={g.key}
              label={`${g.label} (${g.rules.length})`}
            />
          ))}
          {menuPermissions?.create && (
            <Tab
              value="__add__"
              iconPosition="start"
              icon={<Iconify icon="mingcute:add-line" width={18} />}
              label="Шинэ муж"
            />
          )}
        </Tabs>

        {/* Сонгосон масштабын мужийн дүрмүүд */}
        {!adding && (
          <Grid container spacing={2}>
            {rulesLoading && renderSkeletonCards}
            {!rulesLoading &&
              activeGroup?.rules?.map((rule, index) => (
                <Grid item xs={12} sm={6} md={4} key={rule.id}>
                  <RuleCard
                    rule={rule}
                    index={index}
                    onEdit={() => {
                      setAdding(false);
                      handleEditRule(rule);
                    }}
                    onDelete={() => handleDeleteRule(rule.id)}
                    menuPermissions={menuPermissions}
                  />
                </Grid>
              ))}
            {!rulesLoading && scaleGroups.length === 0 && renderEmptyState}
          </Grid>
        )}

        {/* Inline форм — нэмэх эсвэл засах үед доор гарна */}
        {(adding || editingRule) && (
          <Card
            sx={{
              mt: 3,
              p: 2,
              border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.3)}`,
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 2 }}
            >
              <Typography variant="subtitle1">
                {editingRule
                  ? `Дүрэм #${editingRule.id} засах`
                  : "Шинэ дүрэм — масштабын муж + style"}
              </Typography>
              <IconButton
                onClick={() => {
                  setAdding(false);
                  handleCloseEdit();
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
            <RuleNewEditForm
              currentRule={editingRule || undefined}
              onCloseForm={() => {
                setAdding(false);
                handleCloseEdit();
              }}
              refetch={rulesMutation}
              layerId={selectedLayerId}
            />
          </Card>
        )}
      </Box>
    </Fade>
  );
}

RuleListView.propTypes = {
  selectedLayerId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onClose: PropTypes.func,
};
