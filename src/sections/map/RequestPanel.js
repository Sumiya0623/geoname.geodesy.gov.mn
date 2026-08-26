"use client";

import PropTypes from "prop-types";
import { useMemo, useState } from "react";

import {
  Box,
  Chip,
  Stack,
  Button,
  Divider,
  Typography,
  CircularProgress,
} from "@mui/material";
import { Icon } from "@iconify/react";

import { useGetRequests, useGetRequestStatuses } from "src/api/request";

// ----------------------------------------------------------------------
// «Хүсэлт» таб — иргэдийн НЭР ӨӨРЧЛӨХ / ШИНЭЭР НЭМЭХ саналууд.
// Газрын зурагт geoname:request_view WMS‑ээр (төлөвөөр өнгөтэй) харагдана;
// энэ панель нь төлөвийн тоо + жагсаалт (дарахад тухайн байрлал руу нисэх).
// Зөвхөн ерөнхий газрын зураг дээр — төслийн зурагт харагдахгүй.
// ----------------------------------------------------------------------

export default function RequestPanel({ onFlyTo, onAddRequest }) {
  const [status, setStatus] = useState(null); // сонгосон төлөв (id)

  const { statuses, statusesLoading, statusesMutation } =
    useGetRequestStatuses();

  // «Шинээр» төлөв — DB дээрх нэрээр (REQUEST_STATUS: Өөрчлөх/Шинээр/Хүчингүй)
  const newStatus = useMemo(
    () => (statuses || []).find((s) => (s.name || "").startsWith("Шинээр")),
    [statuses],
  );
  // Товч нь ЗӨВХӨН «Шинээр» таб идэвхтэй үед харагдана
  const onNewTab = !!newStatus && status === newStatus.id;

  const body = useMemo(
    () => ({
      page: 1,
      page_size: 100,
      ordering: "-created_date",
      ...(status ? { status: status } : {}),
    }),
    [status],
  );
  const { requests, requestsLoading, requestsMutation } = useGetRequests(body);

  const handleStatus = (id) => {
    setStatus((prev) => (prev === id ? null : id));
  };

  // Форм нь ЭНЭ нарийн панелд биш, газрын зураг дээр хөвөгч цонхоор нээгдэнэ
  // (панель дотор багтахгүй, доош гүйдэггүй байсан).
  const openForm = () =>
    onAddRequest?.({
      status: newStatus,
      onCreated: () => {
        requestsMutation();
        statusesMutation();
      },
    });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Төлөвийн тоо — дарж шүүнэ */}
      <Box sx={{ px: 1.5, py: 1, flexShrink: 0 }}>
        {statusesLoading ? (
          <CircularProgress size={18} />
        ) : (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {(statuses || []).map((s) => (
              <Chip
                key={s.id ?? s.name}
                label={`${s.name} ${s.count ?? s.request_count ?? 0}`}
                variant={status === s.id ? "filled" : "soft"}
                onClick={() => handleStatus(s.id)}
                sx={{
                  cursor: "pointer",
                  ...(s.color
                    ? { bgcolor: status === s.id ? s.color : undefined }
                    : {}),
                  ...(status === s.id ? { color: "#fff" } : {}),
                }}
              />
            ))}
          </Stack>
        )}
      </Box>

      {/* «Шинээр» таб — хүсэлт илгээх (шинэ нэр бүртгэхтэй ижил урсгал).
          Форм нь газрын зураг дээр хөвөгч цонхоор нээгдэнэ. */}
      {onNewTab && (
        <Box sx={{ px: 1.5, pb: 1, flexShrink: 0 }}>
          <Button
            fullWidth
            size="small"
            variant="contained"
            color="primary"
            startIcon={<Icon icon="solar:add-circle-bold" />}
            onClick={openForm}
          >
            Хүсэлт илгээх
          </Button>
        </Box>
      )}

      <Divider />

      {/* Хүсэлтийн жагсаалт — дарахад газрын зурагт очно */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {requestsLoading && (
          <Stack alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={20} />
          </Stack>
        )}

        {!requestsLoading && !requests.length && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", px: 1.5, py: 2 }}
          >
            Хүсэлт олдсонгүй.
          </Typography>
        )}

        {requests.map((r) => {
          const opt = (r.options || [])[0];
          const label = opt?.name || r.name?.name || `Хүсэлт #${r.id}`;
          const hasLoc = r.lat != null && r.lon != null;
          return (
            <Box
              key={r.id}
              // onFlyTo нь {center,zoom} эсвэл {bbox} хэлбэрийг хүлээдэг —
              // энгийн массив дамжуулж байсан тул дарахад юу ч болдоггүй байв.
              onClick={() =>
                hasLoc &&
                onFlyTo?.({
                  center: [Number(r.lon), Number(r.lat)],
                  zoom: 14,
                })
              }
              sx={{
                px: 1.5,
                py: 0.75,
                borderBottom: "1px solid #f5f5f5",
                cursor: hasLoc ? "pointer" : "default",
                "&:hover": { bgcolor: hasLoc ? "action.hover" : undefined },
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                    {label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {[
                      r.name?.name ? `${r.name.name} →` : "Шинээр нэмэх",
                      r.type?.name,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Typography>
                </Box>
                {r.status?.name && (
                  <Chip
                    label={r.status.name}
                    sx={{
                      flexShrink: 0,
                      ...(r.status.color
                        ? { bgcolor: r.status.color, color: "#fff" }
                        : {}),
                    }}
                  />
                )}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

RequestPanel.propTypes = {
  onFlyTo: PropTypes.func,
  onAddRequest: PropTypes.func,
};
