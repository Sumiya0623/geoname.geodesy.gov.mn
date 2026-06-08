"use client";

import { useState, useMemo, useCallback } from "react";

import {
  Box,
  Card,
  Grid,
  Stack,
  Button,
  Collapse,
  Container,
  Typography,
  CardActionArea,
  CircularProgress,
} from "@mui/material";
import { Icon } from "@iconify/react";

import { paths } from "src/routes/paths";
import { useBoolean } from "src/hooks/use-boolean";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import { useGetNameClasses } from "src/api/nameclass";

import Iconify from "src/components/iconify";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";

import NameClassTreeRow from "../nameclass-tree-row";
import NameClassInlineForm from "../nameclass-inline-form";

// ----------------------------------------------------------------------

export default function NameClassListView() {
  const menuPermissions = useMenuPermissions({ content: "nameclass" });

  const typeForm = useBoolean();
  const childForm = useBoolean();
  const editForm = useBoolean();
  const [selectedId, setSelectedId] = useState(null);

  // Үндсэн төрлүүд (GEONAME_TYPES, parent байхгүй) — картууд
  const {
    nameClasses: types,
    nameClassesLoading: typesLoading,
    nameClassesMutation: typesMutation,
  } = useGetNameClasses({ key: "GEONAME_TYPES" });

  // Сонгосон төрлийн дэд ангиллууд — мод хүснэгт
  const childReq = useMemo(
    () => (selectedId ? { parent: selectedId } : null),
    [selectedId],
  );
  const {
    nameClasses: subclasses,
    nameClassesLoading: subLoading,
    nameClassesMutation: subMutation,
  } = useGetNameClasses(childReq);

  const selectedType = useMemo(
    () => types.find((t) => t.id === selectedId) || null,
    [types, selectedId],
  );

  const handleSelect = useCallback(
    (id) => {
      setSelectedId((prev) => (prev === id ? null : id));
      childForm.onFalse();
    },
    [childForm],
  );

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="Дэвсгэр нэр"
        links={[
          { name: "Дашбоард", href: paths.dashboard.root },
          { name: "Дэвсгэр нэр" },
        ]}
        action={
          menuPermissions?.create && (
            <Button
              color="primary"
              variant="contained"
              onClick={typeForm.onToggle}
              endIcon={
                <Iconify
                  icon="mingcute:down-line"
                  sx={{
                    transition: (theme) => theme.transitions.create("all"),
                    ...(typeForm.value && { transform: "rotate(-180deg)" }),
                  }}
                />
              }
            >
              Төрөл нэмэх
            </Button>
          )
        }
        sx={{ mb: { xs: 3, md: 3 } }}
      />

      {/* Шинэ үндсэн төрөл нэмэх */}
      <Collapse in={typeForm.value} timeout="auto" unmountOnExit>
        <Card sx={{ p: 2, mb: 3 }}>
          <NameClassInlineForm
            parentId={null}
            parentKey="GEONAME_TYPES"
            level={1}
            onCancel={typeForm.onFalse}
            onSaved={async () => {
              typeForm.onFalse();
              await typesMutation();
            }}
          />
        </Card>
      </Collapse>

      {/* Төрлийн картууд */}
      {typesLoading ? (
        <Box sx={{ py: 5, textAlign: "center" }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {types.map((type) => {
            const active = type.id === selectedId;
            return (
              <Grid key={type.id} item xs={12} sm={6} md={4} lg={3}>
                <Card
                  sx={{
                    border: "2px solid",
                    borderColor: active ? "primary.main" : "transparent",
                    boxShadow: active
                      ? (theme) => theme.customShadows?.primary
                      : undefined,
                    transition: "all 0.2s ease",
                  }}
                >
                  <CardActionArea
                    onClick={() => handleSelect(type.id)}
                    sx={{ p: 2.5 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 1.5,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "common.white",
                          bgcolor: type.color || "primary.main",
                          flexShrink: 0,
                        }}
                      >
                        <Icon icon="mdi:map-marker-multiple" width={26} />
                      </Box>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="subtitle1" noWrap>
                          {type.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {type.child_count} үндсэн ангилал
                        </Typography>
                      </Box>
                      <Icon
                        icon={active ? "mdi:chevron-up" : "mdi:chevron-down"}
                        width={22}
                      />
                    </Stack>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
          {types.length === 0 && (
            <Grid item xs={12}>
              <Card sx={{ p: 3, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Дэвсгэр нэрийн төрөл алга байна.
                </Typography>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* Сонгосон төрлийн дэд ангиллын мод хүснэгт */}
      {selectedType && (
        <Card sx={{ px: 2, py: 1 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ py: 1.5 }}
          >
            <Typography variant="h6">
              {selectedType.name} — дэд ангиллууд
            </Typography>
            <Stack direction="row" spacing={1}>
              {menuPermissions?.update && (
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  startIcon={
                    <Iconify
                      icon={editForm.value ? "mdi:minus" : "solar:pen-bold"}
                    />
                  }
                  onClick={editForm.onToggle}
                >
                  {editForm.value ? "Хаах" : "Засах"}
                </Button>
              )}
              {menuPermissions?.create && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={
                    <Iconify
                      icon={childForm.value ? "mdi:minus" : "mingcute:add-line"}
                    />
                  }
                  onClick={childForm.onToggle}
                >
                  {childForm.value ? "Хаах" : "нэмэх"}
                </Button>
              )}
            </Stack>
          </Stack>

          {/* Дээд түвшний төрлийг засах (нэр + код) */}
          <Collapse in={editForm.value} timeout="auto" unmountOnExit>
            <Box
              sx={{
                mb: 1,
                p: 1.5,
                borderLeft: "4px solid",
                borderColor: "primary.light",
                bgcolor: "background.neutral",
                borderRadius: 1,
              }}
            >
              <NameClassInlineForm
                currentItem={selectedType}
                level={1}
                onCancel={editForm.onFalse}
                onSaved={async () => {
                  editForm.onFalse();
                  await typesMutation();
                }}
              />
            </Box>
          </Collapse>

          <Collapse in={childForm.value} timeout="auto" unmountOnExit>
            <Box
              sx={{
                mb: 1,
                p: 1.5,
                borderLeft: "4px solid",
                borderColor: "success.light",
                bgcolor: "background.neutral",
                borderRadius: 1,
              }}
            >
              <NameClassInlineForm
                parentId={selectedType.id}
                parentKey={selectedType.key}
                level={2}
                onCancel={childForm.onFalse}
                onSaved={async () => {
                  childForm.onFalse();
                  await subMutation();
                  await typesMutation();
                }}
              />
            </Box>
          </Collapse>

          {subLoading ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <CircularProgress size={22} />
            </Box>
          ) : subclasses.length > 0 ? (
            <Box sx={{ pb: 1 }}>
              {subclasses.map((item, idx) => (
                <NameClassTreeRow
                  key={item.id}
                  item={item}
                  level={0}
                  path={[idx + 1]}
                  parentMutation={async () => {
                    await subMutation();
                    await typesMutation();
                  }}
                  menuPermissions={menuPermissions}
                />
              ))}
            </Box>
          ) : (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Энэ төрөлд дэд ангилал бүртгэгдээгүй байна.
              </Typography>
            </Box>
          )}
        </Card>
      )}
    </Container>
  );
}
