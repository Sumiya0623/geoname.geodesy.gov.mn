import { useMemo, useState } from "react";
import { Button, Link } from "@mui/material";
import {
  Box,
  Card,
  IconButton,
  MenuItem,
  Stack,
  Typography,
  CircularProgress,
} from "@mui/material";

import { Icon } from "@iconify/react";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import { useBoolean } from "src/hooks/use-boolean";
import { useGetConstants } from "src/api/constant";
import SubLevelInlineForm from "./sub-level-inline-form";

import { paths } from "src/routes/paths";
function TreeRow({
  item,
  index = 1,
  level = 0,
  onEditRoot,
  handleDeleteRow = () => {},
  parentMutation = () => {},
  menuPermissions
}) {
  const [editMode, setEditMode] = useState(false);
  const [childFormOpen, setChildFormOpen] = useState(false);

  const confirm = useBoolean();
  const popover = usePopover();

  const requestBody = useMemo(
    () => ({
      parent: item?.id,
    }),
    [item?.id]
  );

  const {
    constants: children,
    constantsLoading,
    constantsMutation,
  } = useGetConstants(level === 0 ? requestBody : null);

  return (
    <>
      <Card
        sx={{
          mb: 2,
          ml: level * 3,
          boxShadow: level === 0 ? 3 : 1,
          borderRadius: 2,
          border: level === 0 ? "2px solid" : "1px solid",
          borderColor: level === 0 ? "primary.light" : "divider",
          overflow: "hidden",
          transition: "all 0.2s ease-in-out",
          "&:hover": {
            boxShadow: level === 0 ? 4 : 2,
            transform: "translateY(-1px)",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            p: 2,
            bgcolor:
              level === 0
                ? "linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(25, 118, 210, 0.02) 100%)"
                : "background.paper",
          }}
        >
          {level === 0 && (
            <Box
              sx={{
                mr: 2,
                p: 1,
                borderRadius: 1,
                bgcolor: "primary.lighter",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Icon
                icon="mdi:server"
                width={20}
                height={20}
                style={{ color: "#1976d2" }}
              />
            </Box>
          )}
          {item?.parent ? (
            menuPermissions?.detail ? (
              <Link
                href={paths.dashboard.geoserver.layers(item?.id)}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={2}
                  flexGrow={1}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      fontWeight: 500,
                    }}
                  >
                    {index}.
                  </Typography>
                  <Typography
                    variant={level === 0 ? "h6" : "subtitle2"}
                    sx={{
                      fontWeight: level === 0 ? 600 : 500,
                      color: level === 0 ? "primary.main" : "text.primary",
                    }}
                  >
                    {item.name}
                  </Typography>
                </Stack>
              </Link>
            ) : (
              <Stack
                direction="row"
                alignItems="center"
                spacing={2}
                flexGrow={1}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    fontWeight: 500,
                  }}
                >
                  {index}.
                </Typography>
                <Typography
                  variant={level === 0 ? "h6" : "subtitle2"}
                  sx={{
                    fontWeight: level === 0 ? 600 : 500,
                    color: level === 0 ? "primary.main" : "text.primary",
                  }}
                >
                  {item.name}
                </Typography>
              </Stack>
            )
          ) : (
            <Stack direction="row" alignItems="center" spacing={2} flexGrow={1}>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  fontWeight: 500,
                }}
              >
                {index}.
              </Typography>
              <Typography
                variant={level === 0 ? "h6" : "subtitle2"}
                sx={{
                  fontWeight: level === 0 ? 600 : 500,
                  color: level === 0 ? "primary.main" : "text.primary",
                }}
              >
                {item.name}
              </Typography>
            </Stack>
          )}

          <Stack direction="row" spacing={1}>
            {level === 0 ? (
              menuPermissions?.create &&
              <IconButton
                size="small"
                color={childFormOpen ? "primary" : "default"}
                onClick={() => {
                  if (editMode) return;
                }}
                sx={{
                  mr: 0.5,
                  bgcolor: childFormOpen ? "primary.lighter" : "transparent",
                  "&:hover": {
                    bgcolor: childFormOpen ? "primary.light" : "action.hover",
                  },
                }}
                title={childFormOpen ? "хаах" : "Нэмэх"}
              >
                <Icon
                  icon={
                    childFormOpen
                      ? "mdi:minus-circle-outline"
                      : "mdi:plus-circle-outline"
                  }
                />
              </IconButton>
            ) : (
              menuPermissions?.detail &&
              <IconButton
                size="small"
                // onClick={popover.onOpen}
                href={paths.dashboard.geoserver.layers(item?.id)}
                sx={{
                  ml: 2,
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
                target="_blank"
                id={`geoserver-rate-${index}`}
              >
                <Icon icon="quill:link-out" />
              </IconButton>
            )}
            <IconButton
              size="small"
              onClick={popover.onOpen}
              sx={{
                "&:hover": {
                  bgcolor: "action.hover",
                },
              }}
            >
              <Icon icon="mdi:dots-vertical" />
            </IconButton>
          </Stack>

          <CustomPopover
            open={popover.open}
            onClose={popover.onClose}
            arrow="right-top"
            sx={{ width: 160 }}
          >
            {menuPermissions?.detail &&
              <MenuItem onClick={popover.onClose}>
                <Icon icon="solar:eye-bold" />
                Дэлгэрэнгүй
              </MenuItem>
            }
            {menuPermissions?.update &&
              <MenuItem
                onClick={() => {
                  setEditMode(true);
                  popover.onClose();
                }}
              >
                <Icon icon="solar:pen-bold" />
                Засах
              </MenuItem>
            }
            {menuPermissions?.delete &&
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
            }
          </CustomPopover>

          <ConfirmDialog
            open={confirm.value}
            onClose={confirm.onFalse}
            title="Та устгахдаа итгэлтэй байна уу?"
            content="Энэ үйлдлийг буцаах боломжгүй."
            showCloseButton={false}
            action={
              <Button
                variant="outlined" 
                color="error"
                onClick={() => {
                  confirm.onFalse();
                  Promise.resolve(
                    handleDeleteRow && handleDeleteRow(item.id)
                  ).then(() => {
                    runParentMutation();
                  });
                }}
              >
                Тийм
              </Button>
            }
          />
        </Box>
      </Card>

      {editMode && (
        <>
          <Box sx={{ ml: level * 3, mb: 2 }}>
            <Card
              sx={{
                borderLeft: "4px solid",
                borderColor: "warning.light",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <Box sx={{ p: 2 }}>
                <SubLevelInlineForm
                  currentConstant={item}
                  parentId={
                    level === 0 ? null : item?.parent?.id || item?.parent
                  }
                  onCancel={() => {
                    setEditMode(false);
                  }}
                  onSaved={async () => {
                    setEditMode(false);
                    parentMutation();
                  }}
                />
              </Box>
            </Card>
          </Box>
        </>
      )}

      {level === 0 && (
        <>
          {childFormOpen && (
            <Box sx={{ ml: 3, mb: 2 }}>
              <Card
                sx={{
                  borderLeft: "4px solid",
                  borderColor: "primary.light",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <Box sx={{ p: 2 }}>
                  <SubLevelInlineForm
                    currentConstant={null}
                    parentId={item.id}
                    onCancel={() => {
                      setChildFormOpen(false);
                    }}
                    onSaved={async () => {
                      setChildFormOpen(false);
                      await constantsMutation();
                    }}
                  />
                </Box>
              </Card>
            </Box>
          )}

          {constantsLoading ? (
            <Box
              sx={{
                ml: 3,
                py: 2,
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Ачааллаж байна...
              </Typography>
            </Box>
          ) : (
            <>
              {children && children.length > 0 ? (
                children.map((child, idx) => (
                  <TreeRow
                    key={child.id}
                    item={child}
                    index={idx + 1}
                    level={1}
                    onEditRoot={onEditRoot}
                    handleDeleteRow={handleDeleteRow}
                    parentMutation={constantsMutation}
                    menuPermissions={menuPermissions}
                  />
                ))
              ) : (
                <Box
                  sx={{
                    ml: 3,
                    py: 3,
                    textAlign: "center",
                    color: "text.secondary",
                    bgcolor: "grey.50",
                    borderRadius: 1,
                    mb: 2,
                  }}
                >
                  <Icon
                    icon="mdi:database-off"
                    width={32}
                    height={32}
                    style={{ marginBottom: 8, opacity: 0.5 }}
                  />
                  <Typography variant="body2" sx={{ fontStyle: "italic" }}>
                    Өгөгдөл байхгүй
                  </Typography>
                </Box>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

export default function LazyTreeView({
  constants,
  onEditRoot,
  handleDeleteRow,
  rootMutation = () => {},
  menuPermissions
}) {
  return (
    <Box sx={{ p: 3, pt: 0 }}>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            color: "text.primary",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Icon
            icon="mdi:server-network"
            width={28}
            height={28}
            style={{ color: "#1976d2" }}
          />
          GeoServer Workspace
        </Typography>
      </Box>

      {constants.map((item, index) => (
        <TreeRow
          key={item.id}
          item={item}
          index={index + 1}
          level={0}
          onEditRoot={onEditRoot}
          handleDeleteRow={handleDeleteRow}
          parentMutation={rootMutation}
          menuPermissions={menuPermissions}
        />
      ))}
    </Box>
  );
}
