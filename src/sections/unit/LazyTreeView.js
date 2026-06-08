import { useMemo, useState, useEffect } from "react";
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
import SubLevelInlineForm from "./sub-level-inline-form";
import { useGetUnits } from "src/api/unit";

function TreeRow({
  item,
  index = 1,
  level = 0,
  parentlevels = [],
  onEditRoot,
  handleDeleteRow = () => {},
  parentMutation = () => {},
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
  const {
    units: constants,
    unitsloading: constantsLoading,
    unitsMutation: constantsMutation,
    unitsCount: constantsCount,
  } = useGetUnits(open ? requestBody : null);

  const totalPages = open
    ? Math.max(1, Math.ceil((constantsCount || 0) / pageSize))
    : 1;

  useEffect(() => {
    if (page > 1 && (constantsCount || 0) <= (page - 1) * pageSize) {
      setPage((prev) => Math.max(1, prev - 1));
    }
  }, [constantsCount, page, pageSize]);

  const toggleOpen = () => setOpen((prev) => !prev);

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          pl: level * 4,
          py: 1,
          borderBottom: "1px dashed #ddd",
          bgcolor: open ? "rgba(0, 0, 0, 0.02)" : "transparent",
        }}
      >
        <IconButton size="small" onClick={toggleOpen}>
          <Icon icon={open ? "mdi:chevron-down" : "mdi:chevron-right"} />
        </IconButton>

        <Stack direction="row" alignItems="center" spacing={2} flexGrow={1}>
          <Typography variant="body2">{index}.</Typography>
          <Typography variant="subtitle2">
            {item.unit} - {item.subcount}
          </Typography>
        </Stack>

        <Typography
          variant="body2"
          sx={{ marginRight: 2 }}
          color="text.secondary"
        >
          {item.code}
        </Typography>

        <IconButton
          size="small"
          color={childFormOpen ? "primary" : "default"}
          onClick={() => {
            if (editMode) return;
            const next = !childFormOpen;
            setChildFormOpen(next);
            if (next) {
              setDupFormOpen(false);
              setDupInitial(null);
              if (!open) setOpen(true);
            }
          }}
          sx={{ mr: 0.5 }}
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
        <IconButton
          size="small"
          color={dupFormOpen ? "primary" : "default"}
          onClick={() => {
            if (editMode) return;
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
              parent: item.parent || null,
            });
            setDupFormOpen(true);
          }}
          sx={{ mr: 1 }}
          title={dupFormOpen ? "Хаах" : "Ижил түвшинд хувилах"}
        >
          <Icon
            icon={dupFormOpen ? "mdi:minus-circle-outline" : "mdi:content-copy"}
          />
        </IconButton>

        <IconButton size="small" onClick={popover.onOpen}>
          <Icon icon="mdi:dots-vertical" />
        </IconButton>

        <CustomPopover
          open={popover.open}
          onClose={popover.onClose}
          arrow="right-top"
          sx={{ width: 160 }}
        >
          <MenuItem onClick={popover.onClose}>
            <Icon icon="solar:eye-bold" />
            Дэлгэрэнгүй
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (level === 0 && onEditRoot) {
                onEditRoot(item);
              } else {
                setEditMode(true);
                if (!open) setOpen(true);
              }
              popover.onClose();
            }}
          >
            <Icon icon="solar:pen-bold" />
            Засах
          </MenuItem>
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
              parentId={item.parent ?? ""}
              onCancel={() => {
                setDupFormOpen(false);
                setDupInitial(null);
              }}
              onSaved={async () => {
                setDupFormOpen(false);
                setDupInitial(null);
                parentMutation();
              }}
            />
          </Box>
        </Box>
      )}

      <Collapse in={open} timeout="auto" unmountOnExit>
        {constantsLoading ? (
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
                      await constantsMutation();
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
                    parentId={item.id}
                    onCancel={() => {
                      setEditMode(false);
                    }}
                    onSaved={async () => {
                      setEditMode(false);
                      parentMutation();
                    }}
                  />
                </Box>
              </Box>
            )}

            {open && !constantsLoading && constantsCount > pageSize && (
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
                  Нийт: {constantsCount}
                </Typography>
              </Stack>
            )}
            {constants && constants.length > 0 ? (
              constants.map((child, idx) => (
                <TreeRow
                  key={child.id}
                  item={child}
                  index={idx + 1}
                  level={level + 1}
                  parentlevels={[...parentlevels, item]}
                  onEditRoot={onEditRoot}
                  handleDeleteRow={handleDeleteRow}
                  parentMutation={constantsMutation}
                />
              ))
            ) : (
              <>
                <Box
                  sx={{
                    pl: (level + 1) * 4 + 2,
                    py: 1,
                    color: "text.secondary",
                  }}
                >
                  <Typography variant="body2">Өгөгдөл байхгүй.</Typography>
                </Box>
              </>
            )}
          </>
        )}
      </Collapse>
    </>
  );
}

export default function LazyTreeView({
  levels,
  onEditRoot,
  handleDeleteRow,
  rootMutation = () => {},
}) {
  return (
    <>
      {levels.map((item, index) => (
        <TreeRow
          key={item.id}
          item={item}
          index={index + 1}
          parentlevels={[]}
          onEditRoot={onEditRoot}
          handleDeleteRow={handleDeleteRow}
          parentMutation={rootMutation}
        />
      ))}
    </>
  );
}
