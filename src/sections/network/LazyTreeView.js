import { useMemo, useState } from "react";
import { Select, MenuItem as MuiMenuItem, Button } from "@mui/material";
import {
  Box,
  Collapse,
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

function LevelRow({
  item,
  index = 1,
  level = 0,
  path = [],
  isRoot = false,
  onEditRoot,
  handleDeleteRow = () => {},
  parentMutation = () => {},
  canHaveChildren = false,
  renderChildren,
  menuPermissions,
}) {
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [dupFormOpen, setDupFormOpen] = useState(false);
  const [dupInitial, setDupInitial] = useState(null);
  const [childFormOpen, setChildFormOpen] = useState(false);

  const confirm = useBoolean();
  const popover = usePopover();

  const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const requestBody = useMemo(
    () => ({
      page,
      page_size: pageSize,
      parent: item?.id,
    }),
    [item?.id, page, pageSize]
  );

  const shouldFetchChildren = canHaveChildren && open;

  const {
    constants: childConstants = [],
    constantsLoading: childLoading = false,
    constantsCount: childCount = 0,
    constantsMutation: childMutation,
  } = useGetConstants(
    canHaveChildren ? (shouldFetchChildren ? requestBody : null) : null
  );

  const refreshChildren =
    typeof childMutation === "function"
      ? childMutation
      : () => Promise.resolve();

  const totalPages = shouldFetchChildren
    ? Math.max(1, Math.ceil((childCount || 0) / pageSize))
    : 1;

  // useEffect(() => {
  //   if (!canHaveChildren || !shouldFetchChildren) {
  //     return;
  //   }
  //   if (page > 1 && (childCount || 0) <= (page - 1) * pageSize) {
  //     setPage((prev) => Math.max(1, prev - 1));
  //   }
  // }, [canHaveChildren, shouldFetchChildren, childCount, page, pageSize]);

  const effectivePath = useMemo(() => {
    if (Array.isArray(path) && path.length > 0) {
      return path;
    }
    return [index];
  }, [index, path]);

  const displayIndex = useMemo(
    () => `${effectivePath.join(".")}.`,
    [effectivePath]
  );

  const runParentMutation = () =>
    Promise.resolve(parentMutation ? parentMutation() : undefined);

  const runChildMutation = () => Promise.resolve(refreshChildren());

  const toggleOpen = () => {
    if (!canHaveChildren) {
      return;
    }
    setOpen((prev) => !prev);
  };

  const handleChildFormToggle = () => {
    if (!canHaveChildren || editMode) {
      return;
    }
    const next = !childFormOpen;
    setChildFormOpen(next);
    if (next) {
      setDupFormOpen(false);
      setDupInitial(null);
      if (!open) {
        setOpen(true);
      }
    }
  };

  const handleDuplicateToggle = () => {
    if (editMode) {
      return;
    }
    if (dupFormOpen) {
      setDupFormOpen(false);
      setDupInitial(null);
      return;
    }
    setChildFormOpen(false);
    setDupInitial({
      key: item.key,
      name: item.name,
      label: item.label,
      code: item.code,
      parent: item.parent?.id || item.parent || null,
    });
    setDupFormOpen(true);
  };

  const handleEditClick = () => {
    if (isRoot && onEditRoot) {
      onEditRoot(item);
    } else {
      setEditMode(true);
      if (canHaveChildren && !open) {
        setOpen(true);
      }
    }
    popover.onClose();
  };

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          pl: level * 4,
          py: 1,
          borderBottom: "1px dashed #ddd",
          bgcolor:
            open && canHaveChildren ? "rgba(0, 0, 0, 0.02)" : "transparent",
        }}
      >
        <IconButton
          size="small"
          onClick={canHaveChildren ? toggleOpen : undefined}
          disabled={!canHaveChildren}
          sx={!canHaveChildren ? { visibility: "hidden" } : undefined}
          id={`network-exp-${effectivePath.join("-")}`}
        >
          <Icon
            icon={
              open && canHaveChildren ? "mdi:chevron-down" : "mdi:chevron-right"
            }
          />
        </IconButton>

        <Stack direction="row" alignItems="center" spacing={2} flexGrow={1}>
          <Typography variant="body2">{displayIndex}</Typography>
          <Typography variant="subtitle2">{item.name}</Typography>
        </Stack>

        <Typography
          variant="body2"
          sx={{ marginRight: 2 }}
          color="text.secondary"
        >
          {item.code}
        </Typography>

        {canHaveChildren && menuPermissions?.create && (
          <IconButton
            size="small"
            color={childFormOpen ? "primary" : "default"}
            onClick={handleChildFormToggle}
            sx={{ mr: 0.5 }}
            title={childFormOpen ? "хаах" : "Нэмэх"}
            id={`network-add-${effectivePath.join("-")}`}
          >
            <Icon
              icon={
                childFormOpen
                  ? "mdi:minus-circle-outline"
                  : "mdi:plus-circle-outline"
              }
            />
          </IconButton>
        )}

        {menuPermissions?.copy && (
          <IconButton
            size="small"
            color={dupFormOpen ? "primary" : "default"}
            onClick={handleDuplicateToggle}
            sx={{ mr: 1 }}
            title={dupFormOpen ? "Хаах" : "Ижил түвшинд хувилах"}
            id={`network-dup-${effectivePath.join("-")}`}
          >
            <Icon
              icon={
                dupFormOpen ? "mdi:minus-circle-outline" : "mdi:content-copy"
              }
            />
          </IconButton>
        )}

        <IconButton
          size="small"
          onClick={popover.onOpen}
          id={`network-edit-${effectivePath.join("-")}`}
        >
          <Icon icon="mdi:dots-vertical" />
        </IconButton>

        <CustomPopover
          open={popover.open}
          onClose={popover.onClose}
          arrow="right-top"
          sx={{ width: 160 }}
        >
          {/* {menuPermissions?.detail && (
            <MenuItem onClick={popover.onClose}>
              <Icon icon="solar:eye-bold" />
              Дэлгэрэнгүй
            </MenuItem>
          )} */}

          {menuPermissions?.update && (
            <MenuItem onClick={handleEditClick}>
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

      {dupFormOpen && (
        <Box
          sx={{
            pl: level * 4,
            pr: 1,
            py: 1,
          }}
        >
          <Box
            sx={{
              bgcolor: "background.paper",
              borderLeft: "4px solid",
              borderColor: "secondary.light",
              pl: 1,
            }}
          >
            <SubLevelInlineForm
              currentConstant={null}
              initialValues={dupInitial}
              parentId={item?.parent?.id ?? item?.parent ?? ""}
              onCancel={() => {
                setDupFormOpen(false);
                setDupInitial(null);
              }}
              onSaved={async () => {
                setDupFormOpen(false);
                setDupInitial(null);
                await runParentMutation();
              }}
            />
          </Box>
        </Box>
      )}

      {canHaveChildren ? (
        <Collapse in={open} timeout="auto" unmountOnExit>
          {childLoading ? (
            <Box sx={{ pl: (level + 1) * 2, py: 1 }}>
              <CircularProgress size={20} />
            </Box>
          ) : (
            <>
              {childFormOpen && (
                <Box
                  sx={{
                    pl: (level + 1) * 2 + 4,
                    pr: 1,
                    py: 1,
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: "background.paper",
                      borderLeft: "4px solid",
                      borderColor: "primary.light",
                      pl: 1,
                    }}
                  >
                    <SubLevelInlineForm
                      currentConstant={null}
                      parentId={item.id}
                      onCancel={() => {
                        setChildFormOpen(false);
                      }}
                      onSaved={async () => {
                        setChildFormOpen(false);
                        await runChildMutation();
                      }}
                    />
                  </Box>
                </Box>
              )}

              {editMode && (
                <Box
                  sx={{
                    pl: (level + 1) * 4 + 2,
                    pr: 1,
                    py: 1,
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: "background.paper",
                      borderLeft: "4px solid",
                      borderColor: "primary.light",
                      pl: 1,
                    }}
                  >
                    <SubLevelInlineForm
                      currentConstant={item}
                      parentId={item?.id}
                      onCancel={() => {
                        setEditMode(false);
                      }}
                      onSaved={async () => {
                        setEditMode(false);
                        await runParentMutation();
                      }}
                    />
                  </Box>
                </Box>
              )}

              {open && !childLoading && childCount > pageSize && (
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{
                    pl: (level + 1) * 4 + 2,
                    pr: 2,
                    py: 1,
                  }}
                >
                  <IconButton
                    size="small"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <Icon icon="mdi:chevron-left" />
                  </IconButton>
                  <Typography
                    variant="caption"
                    sx={{ minWidth: 80, textAlign: "center" }}
                  >
                    Хуудас {page} / {totalPages}
                  </Typography>
                  <IconButton
                    size="small"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <Icon icon="mdi:chevron-right" />
                  </IconButton>
                  <Select
                    size="small"
                    value={pageSize}
                    onChange={(e) => {
                      const newSize = Number(e.target.value);
                      setPageSize(newSize);
                      setPage(1);
                    }}
                    sx={{ height: 30, ".MuiSelect-select": { py: 0.5, px: 1 } }}
                  >
                    {PAGE_SIZE_OPTIONS.map((sz) => (
                      <MuiMenuItem key={sz} value={sz}>
                        {sz}/хуудас
                      </MuiMenuItem>
                    ))}
                  </Select>
                  <Typography variant="caption" color="text.secondary">
                    Нийт: {childCount}
                  </Typography>
                </Stack>
              )}

              {childConstants && childConstants.length > 0 ? (
                renderChildren ? (
                  renderChildren({
                    items: childConstants,
                    parent: item,
                    onEditRoot,
                    handleDeleteRow,
                    parentMutation: refreshChildren,
                    parentPath: effectivePath,
                  })
                ) : null
              ) : (
                <Box
                  sx={{
                    pl: (level + 1) * 4 + 2,
                    py: 1,
                    color: "text.secondary",
                  }}
                >
                  <Typography variant="body2">Өгөгдөл байхгүй.</Typography>
                </Box>
              )}
            </>
          )}
        </Collapse>
      ) : (
        editMode && (
          <Box
            sx={{
              pl: (level + 1) * 4 + 2,
              pr: 1,
              py: 1,
            }}
          >
            <Box
              sx={{
                bgcolor: "background.paper",
                borderLeft: "4px solid",
                borderColor: "primary.light",
                pl: 1,
              }}
            >
              <SubLevelInlineForm
                currentConstant={item}
                parentId={item?.id}
                onCancel={() => {
                  setEditMode(false);
                }}
                onSaved={async () => {
                  setEditMode(false);
                  await runParentMutation();
                }}
              />
            </Box>
          </Box>
        )
      )}
    </>
  );
}

function SecondLevelRow({
  item,
  index,
  path = [],
  onEditRoot,
  handleDeleteRow,
  parentMutation,
  menuPermissions
}) {
  return (
    <LevelRow
      item={item}
      index={index}
      level={1}
      path={path}
      onEditRoot={onEditRoot}
      handleDeleteRow={handleDeleteRow}
      parentMutation={parentMutation}
      canHaveChildren={false}
      menuPermissions={menuPermissions}
    />
  );
}

function FirstLevelRow({
  item,
  index,
  onEditRoot,
  handleDeleteRow,
  parentMutation,
  menuPermissions,
}) {
  const path = [index];
  return (
    <LevelRow
      item={item}
      index={index}
      level={0}
      isRoot
      path={path}
      onEditRoot={onEditRoot}
      handleDeleteRow={handleDeleteRow}
      parentMutation={parentMutation}
      menuPermissions={menuPermissions}
      canHaveChildren
      renderChildren={({
        items,
        onEditRoot: rootEdit,
        handleDeleteRow: deleteHandler,
        parentMutation: childMutation,
        parentPath,
      }) =>
        items.map((child, idx) => (
          <SecondLevelRow
            key={child.id}
            item={child}
            index={idx + 1}
            path={[...(parentPath || []), idx + 1]}
            onEditRoot={rootEdit}
            handleDeleteRow={deleteHandler}
            parentMutation={childMutation}
            menuPermissions={menuPermissions}
          />
        ))
      }
    />
  );
}

export default function LazyTreeView({
  constants,
  onEditRoot,
  handleDeleteRow,
  rootMutation = () => {},
  menuPermissions,
}) {
  return (
    <>
      {constants.map((item, index) => (
        <FirstLevelRow
          key={item.id}
          item={item}
          index={index + 1}
          onEditRoot={onEditRoot}
          handleDeleteRow={handleDeleteRow}
          parentMutation={rootMutation}
          menuPermissions={menuPermissions}
        />
      ))}
    </>
  );
}
