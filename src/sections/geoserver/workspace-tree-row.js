import PropTypes from "prop-types";
import { useMemo, useState } from "react";

import {
  Box,
  Stack,
  Chip,
  Button,
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
import { useGetWorkspaceTree } from "src/api/workspace";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";

import WorkspaceInlineForm from "./workspace-inline-form";

// ----------------------------------------------------------------------
// GeoServer workspace модны нэг мөр — цааш задарч дэд зангилаагаа lazy
// татна. Child тоо, засах/устгах/нэмэх үйлдэлтэй.
// ----------------------------------------------------------------------

export default function WorkspaceTreeRow({
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
    [open.value, item.id]
  );

  const {
    workspaces: children,
    workspacesLoading: childLoading,
    workspacesMutation: childMutation,
  } = useGetWorkspaceTree(requestBody);

  const toggleOpen = () => open.onToggle();

  const handleAddToggle = () => {
    const next = !addOpen;
    setAddOpen(next);
    if (next && !open.value) open.onTrue();
  };

  const handleDelete = async () => {
    confirm.onFalse();
    try {
      await axiosInstance.delete(endpoints.workspace.delete(item.id));
      enqueueSnackbar("Workspace устгагдлаа");
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
        <IconButton size="small" onClick={toggleOpen}>
          <Icon icon={open.value ? "mdi:chevron-down" : "mdi:chevron-right"} />
        </IconButton>

        <Stack direction="row" alignItems="center" spacing={1.5} flexGrow={1}>
          <Typography variant="body2" color="text.secondary">
            {displayIndex}
          </Typography>
          <Typography variant="subtitle2">{item.name}</Typography>
          <Chip
            size="small"
            variant="soft"
            color={childCount > 0 ? "primary" : "default"}
            label={`${childCount} дэд`}
          />
        </Stack>

        {item.code ? (
          <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
            #{item.code}
          </Typography>
        ) : null}

        {menuPermissions?.create && (
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
          content="Энэ зангилаа болон түүний дэд зангилаанууд устгагдана. Энэ үйлдлийг буцаах боломжгүй."
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
            sx={{ borderLeft: "4px solid", borderColor: "primary.light", pl: 1.5 }}
          >
            <WorkspaceInlineForm
              currentItem={item}
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
        {/* дэд зангилаа нэмэх форм */}
        {addOpen && (
          <Box sx={{ pl: (level + 1) * 4 + 6, pr: 1, py: 1 }}>
            <Box
              sx={{
                borderLeft: "4px solid",
                borderColor: "success.light",
                pl: 1.5,
              }}
            >
              <WorkspaceInlineForm
                parentId={item.id}
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
            <WorkspaceTreeRow
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
                Дэд зангилаа алга.
              </Typography>
            </Box>
          )
        )}
      </Collapse>
    </>
  );
}

WorkspaceTreeRow.propTypes = {
  item: PropTypes.object.isRequired,
  level: PropTypes.number,
  path: PropTypes.array,
  parentMutation: PropTypes.func,
  menuPermissions: PropTypes.object,
};
