import PropTypes from "prop-types";
import { useRef, useState } from "react";

import { Box, Chip, Stack, Button, Typography } from "@mui/material";

import Iconify from "src/components/iconify";
import { angleToDirection } from "src/utils/geoDirection";

// ----------------------------------------------------------------------
// Зураг + зовхис сонгогч. Олон зураг (jpg/png) сонгож, тус бүрд объектоос авсан
// чиглэлийг КОМПАС дээр чирж тохируулна. value = [{file, deg}], onChange‑ээр удирдана.
// (geoname зураг нэмэх бүх газар нэгдсэн UI).
// ----------------------------------------------------------------------

// Компас — N=дээш, цагийн зүүний дагуу. Чирэхэд азимут (deg) буцаана.
function Compass({ value = 0, onChange, size = 190 }) {
  const ref = useRef(null);
  const r = size / 2;
  const ring = r - 22;
  const deg = Number(value) || 0;
  const px = r + ring * Math.sin((deg * Math.PI) / 180);
  const py = r - ring * Math.cos((deg * Math.PI) / 180);

  const setFromEvent = (clientX, clientY) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = clientX - (rect.left + r);
    const dy = clientY - (rect.top + r);
    let a = (Math.atan2(dx, -dy) * 180) / Math.PI;
    a = ((a % 360) + 360) % 360;
    onChange?.(Math.round(a));
  };
  const onDown = (e) => {
    e.preventDefault();
    setFromEvent(e.clientX, e.clientY);
    const move = (ev) => setFromEvent(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      onMouseDown={onDown}
      style={{ cursor: "pointer", touchAction: "none", userSelect: "none" }}
    >
      <circle cx={r} cy={r} r={ring} fill="#f4f6f8" stroke="#c4cdd5" strokeWidth="1.5" />
      <text x={r} y={16} textAnchor="middle" fontSize="12" fontWeight="700" fill="#637381">Хойд</text>
      <text x={size - 20} y={r + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#637381">Зүүн</text>
      <text x={r} y={size - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="#637381">Урд</text>
      <text x={20} y={r + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#637381">Баруун</text>
      <line x1={r} y1={r} x2={px} y2={py} stroke="#1976d2" strokeWidth="2.5" />
      <circle cx={px} cy={py} r={9} fill="#1976d2" stroke="#fff" strokeWidth="2" />
      <circle cx={r} cy={r} r={6} fill="#d32f2f" />
    </svg>
  );
}
Compass.propTypes = {
  value: PropTypes.number,
  onChange: PropTypes.func,
  size: PropTypes.number,
};

export default function PhotoDirectionPicker({ value = [], onChange, label }) {
  const [idx, setIdx] = useState(0);
  const photos = value || [];
  const safeIdx = photos.length ? idx % photos.length : 0;

  const onFiles = (e) => {
    const list = Array.from(e.target.files || []).map((f) => ({ file: f, deg: 0 }));
    if (!list.length) return;
    onChange?.([...photos, ...list]); // ДЭЭР НЬ НЭМНЭ (орлуулахгүй)
    setIdx(photos.length); // шинээр нэмсэн эхний зураг руу
    e.target.value = ""; // ижил файлыг дахин сонгох боломжтой
  };
  const setDeg = (deg) =>
    onChange?.(photos.map((p, i) => (i === safeIdx ? { ...p, deg } : p)));
  const removeCurrent = () => {
    const next = photos.filter((_, i) => i !== safeIdx);
    onChange?.(next);
    setIdx((i) => Math.max(0, Math.min(i, next.length - 1)));
  };
  // Файл бүрийн preview URL-ийг нэг л удаа үүсгэж кэшлэнэ
  const urlsRef = useRef(new Map());
  const urlFor = (file) => {
    if (!urlsRef.current.has(file))
      urlsRef.current.set(file, URL.createObjectURL(file));
    return urlsRef.current.get(file);
  };

  return (
    <Stack spacing={1.5}>
      <Button
        component="label"
        variant="outlined"
        startIcon={<Iconify icon="solar:upload-bold" />}
        sx={{ alignSelf: "flex-start" }}
      >
        {label ||
          (photos.length
            ? `Дахин зураг нэмэх (${photos.length})`
            : "Зураг сонгох (jpg / png)")}
        <input
          hidden
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          onChange={onFiles}
        />
      </Button>

      {photos.length > 0 && (
        <Box>
          {/* Бүх зураг — жижиг thumbnail (дарж сонгоно, шилждэггүй) */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ overflowX: "auto", pb: 1, mb: 0.5 }}
          >
            {photos.map((p, i) => (
              <Box
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                onClick={() => setIdx(i)}
                sx={{
                  position: "relative",
                  flexShrink: 0,
                  width: 60,
                  height: 60,
                  borderRadius: 1,
                  overflow: "hidden",
                  cursor: "pointer",
                  border: "2px solid",
                  borderColor: i === safeIdx ? "primary.main" : "divider",
                }}
              >
                <Box
                  component="img"
                  src={urlFor(p.file)}
                  alt=""
                  sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                {p.deg != null && p.deg !== 0 && (
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      bgcolor: "rgba(0,0,0,0.55)",
                      color: "#fff",
                      fontSize: 9,
                      textAlign: "center",
                    }}
                  >
                    {angleToDirection(p.deg)}
                  </Box>
                )}
              </Box>
            ))}
          </Stack>

          <Stack alignItems="center" spacing={1}>
            <Typography variant="caption" color="text.secondary">
              Объектоос зураг авсан чиглэлийг чирж тохируулна уу
            </Typography>
            <Compass value={photos[safeIdx]?.deg || 0} onChange={setDeg} />
            <Chip
              color="primary"
              label={`Зовхис: ${angleToDirection(photos[safeIdx]?.deg || 0)} (${Math.round(
                photos[safeIdx]?.deg || 0,
              )}°)`}
            />
            <Button
              color="error"
              startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
              onClick={removeCurrent}
            >
              Энэ зургийг хасах
            </Button>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
PhotoDirectionPicker.propTypes = {
  value: PropTypes.array,
  onChange: PropTypes.func,
  label: PropTypes.string,
};
