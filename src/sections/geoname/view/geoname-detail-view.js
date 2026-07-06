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
  Tooltip,
  Divider,
  Container,
  IconButton,
  Typography,
  CardContent,
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
            <Box sx={{ flexGrow: 1, display: "flex", justifyContent: "flex-end" }}>
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

      {/* Үндсэн мэдээлэл */}
      <Card sx={{ mb: 3 }}>
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
                <Box key={t.id} sx={{ display: "flex", alignItems: "center" }}>
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
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              <Icon icon="solar:map-point-bold" width={16} /> Солбицол:{" "}
              {data.lat?.toFixed(6)}, {data.lon?.toFixed(6)} ({data.geom_type})
            </Typography>
          )}
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Засаг захиргаа */}
        <Grid item xs={12} md={6}>
          <Section
            icon="solar:map-bold"
            title="Засаг захиргаа"
            count={data.units?.length}
          >
            {data.units?.length ? (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {data.units.map((u) => (
                  <Chip key={u.id} size="small" label={u.name} variant="soft" />
                ))}
              </Stack>
            ) : (
              <Empty text="Бүртгэлгүй" />
            )}
          </Section>
        </Grid>

        {/* Нэрлэвэр */}
        <Grid item xs={12} md={6}>
          <Section
            icon="solar:map-arrow-square-bold"
            title="Нэрлэвэр"
            count={data.nomeks?.length}
          >
            {data.nomeks?.length ? (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {data.nomeks.map((n) => (
                  <Chip
                    key={n.id}
                    size="small"
                    label={n.code}
                    variant="soft"
                    color="info"
                  />
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
                      {o.order_number} {o.order_date ? `· ${o.order_date}` : ""}
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
                        <Chip size="small" label={r.status} variant="soft" />
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

        {/* Зураг */}
        <Grid item xs={12} md={6}>
          <Section
            icon="solar:gallery-bold"
            title="Зураг"
            count={data.photos?.length}
            onAdd={() => setAddKind("photo")}
          >
            {data.photos?.length ? (
              <Grid container spacing={1}>
                {data.photos.map((p) => (
                  <Grid item xs={6} sm={4} key={p.id}>
                    <Box
                      component="a"
                      href={mediaUrl(p.url)}
                      target="_blank"
                      rel="noopener"
                      sx={{ display: "block" }}
                    >
                      <Box
                        component="img"
                        src={mediaUrl(p.url)}
                        alt=""
                        sx={{
                          width: "100%",
                          height: 110,
                          objectFit: "cover",
                          borderRadius: 1,
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Empty text="Зураг алга" />
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

      <GeonameAddDialog
        kind={addKind}
        geonameId={id}
        onClose={() => setAddKind(null)}
        onDone={() => load(true)}
      />
    </Container>
  );
}

GeonameDetailView.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
