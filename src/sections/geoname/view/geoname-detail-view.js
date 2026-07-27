"use client";

import PropTypes from "prop-types";
import { useState, useEffect, useCallback } from "react";

import {
  Box,
  Card,
  Chip,
  Grid,
  Link,
  Stack,
  Button,
  Dialog,
  Tooltip,
  Divider,
  Container,
  IconButton,
  Typography,
  CardContent,
  DialogContent,
  DialogActions,
  CircularProgress,
} from "@mui/material";
import { Icon } from "@iconify/react";

import { paths } from "src/routes/paths";
import axiosInstance, { endpoints } from "src/utils/axios";

import CustomBreadcrumbs from "src/components/custom-breadcrumbs";

import GeonameAddDialog from "../geoname-add-dialog";

// ----------------------------------------------------------------------

const mediaUrl = (u) =>
  u && u.startsWith("/") ? `${process.env.NEXT_PUBLIC_HOST_API}${u}` : u;

function Section({ icon, title, count, onAdd, children }) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <Icon icon={icon} width={22} />
          <Typography variant="h6">{title}</Typography>
          {typeof count === "number" && (
            <Chip size="small" label={count} variant="soft" color="primary" />
          )}
          {onAdd && (
            <Box
              sx={{ flexGrow: 1, display: "flex", justifyContent: "flex-end" }}
            >
              <Tooltip title="Нэмэх">
                <IconButton size="small" color="primary" onClick={onAdd}>
                  <Icon icon="mingcute:add-line" width={20} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Stack>
        <Divider sx={{ mb: 1.5 }} />
        {children}
      </CardContent>
    </Card>
  );
}
Section.propTypes = {
  icon: PropTypes.string,
  title: PropTypes.string,
  count: PropTypes.number,
  onAdd: PropTypes.func,
  children: PropTypes.node,
};

const Empty = ({ text }) => (
  <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
    {text}
  </Typography>
);
Empty.propTypes = { text: PropTypes.string };

// Зургийн slider — prev/next + 1/N + зураг нэмэх. Дарахад том дэлгэц (lightbox)
// нээж, тэндээс устгана.
function PhotoSlider({ photos, onAdd, onDelete }) {
  const [i, setI] = useState(0);
  const [lightbox, setLightbox] = useState(null); // том харагдах зураг

  const addBtn = onAdd && (
    <Tooltip title="Зураг нэмэх">
      <IconButton
        size="small"
        onClick={onAdd}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          bgcolor: "rgba(0,0,0,0.45)",
          color: "#fff",
          "&:hover": { bgcolor: "rgba(0,0,0,0.65)" },
        }}
      >
        <Icon icon="mingcute:add-line" width={20} />
      </IconButton>
    </Tooltip>
  );

  // Зураггүй — нэмэх талбар
  if (!photos?.length) {
    return (
      <Box
        onClick={onAdd}
        sx={{
          position: "relative",
          width: "100%",
          height: { xs: 240, md: 340 },
          borderRadius: 2,
          border: "1px dashed",
          borderColor: "divider",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          color: "text.secondary",
          cursor: onAdd ? "pointer" : "default",
        }}
      >
        <Icon icon="solar:gallery-add-bold" width={36} />
        <Typography variant="body2">Зураг нэмэх</Typography>
      </Box>
    );
  }

  const idx = i % photos.length;
  const cur = photos[idx];
  const nav = (btn) => (e) => {
    e.stopPropagation();
    setI((p) => (p + btn + photos.length) % photos.length);
  };
  return (
    <>
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: { xs: 240, md: 340 },
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "grey.200",
        }}
      >
        <Box
          component="img"
          src={mediaUrl(cur.url)}
          alt="зураг"
          onClick={() => setLightbox(cur)}
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            cursor: "pointer",
          }}
        />
        {addBtn}
        {cur.desc && (
          <Box
            sx={{
              position: "absolute",
              bottom: 8,
              left: 8,
              bgcolor: "rgba(0,0,0,0.55)",
              color: "#fff",
              px: 1,
              py: 0.25,
              borderRadius: 1,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            <Icon icon="solar:compass-bold" width={14} /> {cur.desc}
          </Box>
        )}
        {photos.length > 1 && (
          <>
            <IconButton
              size="small"
              onClick={nav(-1)}
              sx={{
                position: "absolute",
                top: "50%",
                left: 8,
                transform: "translateY(-50%)",
                bgcolor: "rgba(0,0,0,0.45)",
                color: "#fff",
                "&:hover": { bgcolor: "rgba(0,0,0,0.65)" },
              }}
            >
              <Icon icon="eva:arrow-ios-back-fill" width={22} />
            </IconButton>
            <IconButton
              size="small"
              onClick={nav(1)}
              sx={{
                position: "absolute",
                top: "50%",
                right: 8,
                transform: "translateY(-50%)",
                bgcolor: "rgba(0,0,0,0.45)",
                color: "#fff",
                "&:hover": { bgcolor: "rgba(0,0,0,0.65)" },
              }}
            >
              <Icon icon="eva:arrow-ios-forward-fill" width={22} />
            </IconButton>
            <Box
              sx={{
                position: "absolute",
                bottom: 8,
                left: "50%",
                transform: "translateX(-50%)",
                bgcolor: "rgba(0,0,0,0.55)",
                color: "#fff",
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontSize: 12,
              }}
            >
              {idx + 1}/{photos.length}
            </Box>
          </>
        )}
      </Box>

      {/* Том дэлгэц (lightbox) — устгах товчтой */}
      <Dialog
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent sx={{ p: 0, bgcolor: "#000" }}>
          <Box
            component="img"
            src={mediaUrl(lightbox?.url)}
            alt="зураг"
            sx={{
              width: "100%",
              maxHeight: "80vh",
              objectFit: "contain",
              display: "block",
            }}
          />
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
            {lightbox?.desc ? `Зураг авсан: ${lightbox.desc}` : ""}
          </Typography>
          <Box>
            <Button
              color="error"
              startIcon={<Icon icon="solar:trash-bin-trash-bold" width={18} />}
              onClick={() => {
                onDelete?.(lightbox.id);
                setLightbox(null);
              }}
            >
              Устгах
            </Button>
            <Button color="inherit" onClick={() => setLightbox(null)}>
              Хаах
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
}
PhotoSlider.propTypes = {
  photos: PropTypes.array,
  onAdd: PropTypes.func,
  onDelete: PropTypes.func,
};

export default function GeonameDetailView({ id }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addKind, setAddKind] = useState(null);

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      return axiosInstance
        .get(endpoints.geoname.details(id))
        .then((res) => setData(res?.data || null))
        .catch(() => {
          if (!silent) setData(null);
        })
        .finally(() => setLoading(false));
    },
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleDeletePhoto = async (photoId) => {
    try {
      await axiosInstance.post(endpoints.geoname.delPhoto(id), {
        photo_id: photoId,
      });
      load(true); // дахин ачаална
    } catch (e) {
      /* үл хайхарна */
    }
  };

  if (loading) {
    return (
      <Box sx={{ py: 8, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography>Мэдээлэл олдсонгүй.</Typography>
      </Container>
    );
  }

  const path = data.type_path || [];

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading={data.name || data.number || "Газар зүйн нэр"}
        links={[
          { name: "Газар зүйн нэр", href: paths.dashboard.root },
          { name: data.name || data.number },
        ]}
        sx={{ mb: 3 }}
      />

      <Grid container spacing={3}>
        {/* ЗҮҮН БАГАНА — нэр + бүх хэсэг */}
        <Grid item xs={12} md={6}>
          {/* Үндсэн мэдээлэл */}
          <Card sx={{ mb: 1 }}>
            <CardContent>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={1}
              >
                <Box>
                  <Typography variant="h4">{data.name || "—"}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Дугаар: <b>{data.number || "—"}</b>
                  </Typography>
                </Box>
                <Chip
                  label={data.is_approved ? "Батлагдсан" : "Хүлээгдэж буй"}
                  color={data.is_approved ? "success" : "warning"}
                  variant="soft"
                  sx={{ alignSelf: "flex-start" }}
                />
              </Stack>

              {/* Ангилал (level1/2/3) */}
              {path.length > 0 && (
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.5}
                  flexWrap="wrap"
                  sx={{ mt: 2 }}
                >
                  {path.map((t, i) => (
                    <Box
                      key={t.id}
                      sx={{ display: "flex", alignItems: "center" }}
                    >
                      {i > 0 && (
                        <Typography sx={{ mx: 0.5, color: "text.disabled" }}>
                          ›
                        </Typography>
                      )}
                      <Chip
                        size="small"
                        label={t.name}
                        variant={i === path.length - 1 ? "filled" : "outlined"}
                        color={i === path.length - 1 ? "primary" : "default"}
                      />
                    </Box>
                  ))}
                </Stack>
              )}

              {(data.lat || data.lon) && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 2 }}
                >
                  <Icon icon="solar:map-point-bold" width={16} /> Солбицол:{" "}
                  {data.lat?.toFixed(6)}, {data.lon?.toFixed(6)} (
                  {data.geom_type})
                </Typography>
              )}

              {/* Засаг захиргаа — нэрийн хэсэгт нэгтгэв */}
              <Box sx={{ mt: 2 }}>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, color: "text.secondary" }}
                >
                  Засаг захиргаа
                </Typography>
                {data.units?.length ? (
                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ mt: 0.5 }}
                  >
                    {data.units.map((u) => (
                      <Chip
                        key={u.id}
                        size="small"
                        label={u.name}
                        variant="soft"
                      />
                    ))}
                  </Stack>
                ) : (
                  <Empty text="Бүртгэлгүй" />
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Section‑ууд — нэрийн доор, зүүн баганад */}
          <Grid container spacing={3}>
            {/* Нэрлэвэр — M25/50/100к хэвтээ зэрэгцээ */}
            <Grid item xs={12}>
              <Section
                icon="solar:map-arrow-square-bold"
                title="Нэрлэвэр"
                count={data.nomeks?.reduce(
                  (s, g) => s + (g.nomeks?.length || 0),
                  0,
                )}
              >
                {data.nomeks?.length ? (
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    alignItems="flex-start"
                    divider={<Divider orientation="vertical" flexItem />}
                  >
                    {data.nomeks.map((g) => (
                      <Box
                        key={g.scale_id ?? "x"}
                        sx={{ flex: 1, minWidth: 0 }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 700, color: "text.secondary" }}
                        >
                          {g.scale}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          flexWrap="wrap"
                          useFlexGap
                          sx={{ mt: 0.5 }}
                        >
                          {g.nomeks.map((n) => (
                            <Chip
                              key={n.id}
                              size="small"
                              label={n.code}
                              variant="soft"
                              color="info"
                            />
                          ))}
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Empty text="Бүртгэлгүй" />
                )}
              </Section>
            </Grid>

            {/* Эрх зүйн баримт бичиг */}
            <Grid item xs={12} md={6}>
              <Section
                icon="solar:document-text-bold"
                title="Эрх зүйн баримт бичиг"
                count={data.orders?.length}
                onAdd={() => setAddKind("order")}
              >
                {data.orders?.length ? (
                  <Stack spacing={1}>
                    {data.orders.map((o) => (
                      <Box
                        key={o.id}
                        sx={{
                          p: 1,
                          borderRadius: 1,
                          bgcolor: "background.neutral",
                        }}
                      >
                        <Typography variant="subtitle2">{o.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {o.order_number}{" "}
                          {o.order_date ? `· ${o.order_date}` : ""}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Empty text="Бүртгэлгүй" />
                )}
              </Section>
            </Grid>

            {/* Хүсэлт */}
            <Grid item xs={12} md={6}>
              <Section
                icon="solar:chat-round-line-bold"
                title="Хүсэлт"
                count={data.requests?.length}
                onAdd={() => setAddKind("request")}
              >
                {data.requests?.length ? (
                  <Stack spacing={1}>
                    {data.requests.map((r) => (
                      <Box
                        key={r.id}
                        sx={{
                          p: 1,
                          borderRadius: 1,
                          bgcolor: "background.neutral",
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">
                            {r.description || "—"}
                          </Typography>
                          {r.status && (
                            <Chip
                              size="small"
                              label={r.status}
                              variant="soft"
                            />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {r.purpose}{" "}
                          {r.created_date
                            ? `· ${new Date(r.created_date).toLocaleDateString()}`
                            : ""}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Empty text="Хүсэлт алга" />
                )}
              </Section>
            </Grid>

            {/* Баримт материал */}
            <Grid item xs={12} md={6}>
              <Section
                icon="solar:paperclip-bold"
                title="Баримт материал"
                count={data.attaches?.length}
                onAdd={() => setAddKind("attach")}
              >
                {data.attaches?.length ? (
                  <Stack spacing={1}>
                    {data.attaches.map((a) => (
                      <Link
                        key={a.id}
                        href={mediaUrl(a.url)}
                        target="_blank"
                        rel="noopener"
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Icon icon="solar:file-bold" width={18} />
                        {a.name || "Файл"}
                      </Link>
                    ))}
                  </Stack>
                ) : (
                  <Empty text="Баримт алга" />
                )}
              </Section>
            </Grid>
          </Grid>
        </Grid>

        {/* БАРУУН БАГАНА — зураг + (нэмэх дарвал) inline форм зургийн ДООР */}
        <Grid item xs={12} md={6}>
          <Stack spacing={3}>
            <PhotoSlider
              photos={data.photos}
              onAdd={() => setAddKind("photo")}
              onDelete={handleDeletePhoto}
            />
            {addKind && (
              <GeonameAddDialog
                inline
                kind={addKind}
                geonameId={id}
                onClose={() => setAddKind(null)}
                onDone={() => load(true)}
              />
            )}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

GeonameDetailView.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
