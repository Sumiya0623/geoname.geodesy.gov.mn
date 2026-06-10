import PropTypes from "prop-types";
import { useMemo, useState } from "react";

import {
  Box,
  Stack,
  Chip,
  Button,
  Tooltip,
  Collapse,
  MenuItem,
  IconButton,
  Typography,
  CircularProgress,
} from "@mui/material";
import { Icon } from "@iconify/react";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import { useBoolean } from "src/hooks/use-boolean";
import { useGetNameClasses } from "src/api/nameclass";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";

import NameClassInlineForm from "./nameclass-inline-form";

// ----------------------------------------------------------------------
// Геометр төрлийн icon (level3 — цааш задрахгүй leaf дээр)
const GEOM_ICON = {
  Цэг: "mdi:vector-point",
  Шугам: "mdi:vector-polyline",
  Талбай: "mdi:vector-polygon",
};
const GEOM_COLOR = {
  Цэг: "#e53935",
  Шугам: "#1e88e5",
  Талбай: "#43a047",
};

// ----------------------------------------------------------------------
// Дэвсгэр нэрийн ангиллын нэг мөр — цааш задарч (мод хэлбэрээр) дэд
// ангиллуудаа lazy татна. Child тоо, засах/устгах/нэмэх үйлдэлтэй.
// ----------------------------------------------------------------------

export default function NameClassTreeRow({
  item,
  level = 0,
  path = [],
  parentMutation = () => {},
  menuPermissions = {},
}) {
  const { enqueueSnackbar } = useSnackbar();
  const open = useBoolean();
  const confirm = useBoolean();
  const popover = usePopover();
  const [editMode, setEditMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const childCount = item?.child_count ?? 0;
  const displayIndex = useMemo(() => `${path.join(".")}.`, [path]);

  const requestBody = useMemo(
    () => (open.value ? { parent: item.id } : null),
    [open.value, item.id],
  );

  const {
    nameClasses: children,
    nameClassesLoading: childLoading,
    nameClassesMutation: childMutation,
  } = useGetNameClasses(requestBody);

  const toggleOpen = () => open.onToggle();

  const handleAddToggle = () => {
    const next = !addOpen;
    setAddOpen(next);
    if (next && !open.value) open.onTrue();
  };

  const handleDelete = async () => {
    confirm.onFalse();
    try {
      await axiosInstance.delete(endpoints.nameclass.delete(item.id));
      enqueueSnackbar("Ангилал устгагдлаа");
      parentMutation();
    } catch (error) {
      const detail =
        error?.response?.data?.detail ||
        `Устгах үед алдаа гарлаа (код: ${error?.response?.status ?? "?"})`;
      enqueueSnackbar(detail, { variant: "warning" });
    }
  };

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          pl: level * 4,
          py: 1,
          borderBottom: "1px dashed",
          borderColor: "divider",
          bgcolor: open.value ? "action.hover" : "transparent",
        }}
      >
        {/* Зөвхөн 3 түвшин: level 1 (=3‑р түвшин) цааш задрахгүй тул сумыг нууна */}
        {level < 1 ? (
          <IconButton size="small" onClick={toggleOpen}>
            <Icon icon={open.value ? "mdi:chevron-down" : "mdi:chevron-right"} />
          </IconButton>
        ) : (
          <Box sx={{ width: 34, flexShrink: 0 }} />
        )}

        <Stack direction="row" alignItems="center" spacing={1.5} flexGrow={1}>
          <Typography variant="body2" color="text.secondary">
            {displayIndex}
          </Typography>
          <Typography variant="subtitle2">{item.name}</Typography>
          {childCount > 0 ? (
            <Chip
              size="small"
              variant="soft"
              color="primary"
              label={`${childCount} дэд`}
            />
          ) : (
            <>
              {item.desc && (
                <Tooltip title={item.desc}>
                  <Box
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      color: GEOM_COLOR[item.desc] || "text.secondary",
                    }}
                  >
                    <Icon
                      icon={GEOM_ICON[item.desc] || "mdi:shape-outline"}
                      width={22}
                    />
                  </Box>
                </Tooltip>
              )}
              {/* Level‑3 навч — GeoServer‑т view нийтлэгдсэн эсэх. Алга бол засаж үүсгэнэ. */}
              {item.is_leaf && (
                <Tooltip
                  title={
                    item.gs_exists
                      ? `GeoServer view: ${item.view_name}`
                      : "GeoServer view үүсээгүй — засаж хадгалахад автоматаар үүснэ"
                  }
                >
                  <Chip
                    size="small"
                    variant="soft"
                    color={item.gs_exists ? "success" : "warning"}
                    label={item.gs_exists ? "View ✓" : "View алга"}
                  />
                </Tooltip>
              )}
            </>
          )}
        </Stack>

        {item.code ? (
          <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
            #{item.code}
          </Typography>
        ) : null}

        {/* Зөвхөн 3 түвшин: tree level 0 (=2‑р түвшин) л дэд ангилал нэмнэ.
            level 1 (=3‑р түвшин)‑ээс цааш задрахгүй. */}
        {menuPermissions?.create && level < 1 && (
          <IconButton
            size="small"
            color={addOpen ? "primary" : "default"}
            onClick={handleAddToggle}
            title={addOpen ? "Хаах" : "нэмэх"}
          >
            <Icon
              icon={
                addOpen ? "mdi:minus-circle-outline" : "mdi:plus-circle-outline"
              }
            />
          </IconButton>
        )}

        {(menuPermissions?.update || menuPermissions?.delete) && (
          <IconButton size="small" onClick={popover.onOpen}>
            <Icon icon="mdi:dots-vertical" />
          </IconButton>
        )}

        <CustomPopover
          open={popover.open}
          onClose={popover.onClose}
          arrow="right-top"
          sx={{ width: 160 }}
        >
          {menuPermissions?.update && (
            <MenuItem
              onClick={() => {
                setEditMode(true);
                popover.onClose();
              }}
            >
              <Icon icon="solar:pen-bold" />
              Засах
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
              <Icon icon="solar:trash-bin-trash-bold" />
              Устгах
            </MenuItem>
          )}
        </CustomPopover>

        <ConfirmDialog
          open={confirm.value}
          onClose={confirm.onFalse}
          title="Та устгахдаа итгэлтэй байна уу?"
          content="Энэ ангилал болон түүний дэд ангиллууд устгагдана. Энэ үйлдлийг буцаах боломжгүй."
          action={
            <Button variant="outlined" color="error" onClick={handleDelete}>
              Тийм
            </Button>
          }
        />
      </Box>

      {/* засах форм */}
      {editMode && (
        <Box sx={{ pl: level * 4 + 6, pr: 1, py: 1 }}>
          <Box
            sx={{
              borderLeft: "4px solid",
              borderColor: "primary.light",
              pl: 1.5,
            }}
          >
            <NameClassInlineForm
              currentItem={item}
              level={level + 2}
              onCancel={() => setEditMode(false)}
              onSaved={async () => {
                setEditMode(false);
                await parentMutation();
              }}
            />
          </Box>
        </Box>
      )}

      <Collapse in={open.value} timeout="auto" unmountOnExit>
        {/* дэд ангилал нэмэх форм */}
        {addOpen && (
          <Box sx={{ pl: (level + 1) * 4 + 6, pr: 1, py: 1 }}>
            <Box
              sx={{
                borderLeft: "4px solid",
                borderColor: "success.light",
                pl: 1.5,
              }}
            >
              <NameClassInlineForm
                parentId={item.id}
                parentKey={item.key}
                level={level + 3}
                onCancel={() => setAddOpen(false)}
                onSaved={async () => {
                  setAddOpen(false);
                  await childMutation();
                  await parentMutation();
                }}
              />
            </Box>
          </Box>
        )}

        {childLoading ? (
          <Box sx={{ pl: (level + 1) * 4 + 2, py: 1 }}>
            <CircularProgress size={18} />
          </Box>
        ) : children.length > 0 ? (
          children.map((child, idx) => (
            <NameClassTreeRow
              key={child.id}
              item={child}
              level={level + 1}
              path={[...path, idx + 1]}
              parentMutation={childMutation}
              menuPermissions={menuPermissions}
            />
          ))
        ) : (
          !addOpen && (
            <Box sx={{ pl: (level + 1) * 4 + 2, py: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Дэд ангилал алга.
              </Typography>
            </Box>
          )
        )}
      </Collapse>
    </>
  );
}

NameClassTreeRow.propTypes = {
  item: PropTypes.object.isRequired,
  level: PropTypes.number,
  path: PropTypes.array,
  parentMutation: PropTypes.func,
  menuPermissions: PropTypes.object,
};
