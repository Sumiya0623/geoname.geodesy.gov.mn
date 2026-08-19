"use client";

// ---------------------------------------------------------------------------
// Газрын зургийн ДЭЭД талд: сонгосон нутгийн онцлох нэрс —
// хамгийн их давтагдсан, хамгийн урт, хамгийн богино (тус бүр 3).
// ---------------------------------------------------------------------------

import PropTypes from "prop-types";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import Iconify from "src/components/iconify";

const CARDS = [
  {
    key: "common",
    title: "Хамгийн түгээмэл",
    unit: "газар",
    icon: "solar:copy-bold-duotone",
    color: "#7dd3fc",
  },
  {
    key: "longest",
    title: "Хамгийн урт",
    unit: "тэмдэгт",
    icon: "solar:ruler-angular-bold-duotone",
    color: "#c4b5fd",
  },
  {
    key: "shortest",
    title: "Хамгийн богино",
    unit: "тэмдэгт",
    icon: "solar:minimize-square-bold-duotone",
    color: "#fcd34d",
  },
];

export default function NameFacts({ facts, loading = false, columns = 3 }) {
  return (
    <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
      {CARDS.map((c) => {
        const rows = facts?.[c.key] || [];
        return (
          <Grid item xs={12} sm={columns === 1 ? 12 : 4} key={c.key}>
            <Box
              sx={{
                height: 1,
                p: 1.5,
                borderRadius: 3,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                transition: "all 0.3s ease",
                "&:hover": {
                  borderColor: `${c.color}66`,
                  background: "rgba(255,255,255,0.07)",
                },
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={0.75}
                sx={{ mb: 1 }}
              >
                <Iconify icon={c.icon} width={16} sx={{ color: c.color }} />
                <Typography
                  sx={{
                    color: "rgba(226,240,255,0.65)",
                    fontSize: 11,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                  }}
                >
                  {c.title}
                </Typography>
              </Stack>

              <Stack spacing={0.5}>
                {(loading || !rows.length ? [0, 1, 2] : rows).map((r, i) =>
                  typeof r === "number" ? (
                    <Box
                      key={i}
                      sx={{
                        height: 18,
                        borderRadius: 1,
                        background: "rgba(125,211,252,0.08)",
                      }}
                    />
                  ) : (
                    <Stack
                      key={r.name}
                      direction="row"
                      alignItems="center"
                      spacing={1}
                    >
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          flexShrink: 0,
                          borderRadius: "50%",
                          fontSize: 9,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: c.color,
                          border: `1px solid ${c.color}55`,
                        }}
                      >
                        {i + 1}
                      </Box>
                      {/* Урт нэр багтахгүй бол таслаад, бүтнээр нь tooltip-д */}
                      <Tooltip
                        title={r.name}
                        placement="top"
                        arrow
                        enterTouchDelay={0}
                        componentsProps={{
                          tooltip: {
                            sx: {
                              background: "rgba(6, 20, 48, 0.96)",
                              border: "1px solid rgba(125, 211, 252, 0.35)",
                              color: "#e2f0ff",
                              fontSize: 12.5,
                              maxWidth: 320,
                              px: 1.25,
                              py: 0.75,
                            },
                          },
                          arrow: { sx: { color: "rgba(6, 20, 48, 0.96)" } },
                        }}
                      >
                        <Typography
                          sx={{
                            flexGrow: 1,
                            minWidth: 0,
                            color: "#e9f2ff",
                            fontSize: 12.5,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            cursor: "help",
                          }}
                        >
                          {r.name}
                        </Typography>
                      </Tooltip>
                      <Typography
                        sx={{
                          color: c.color,
                          fontSize: 12,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {r.value}
                        <Box
                          component="span"
                          sx={{
                            ml: 0.4,
                            fontSize: 10,
                            fontWeight: 400,
                            color: "rgba(226,240,255,0.45)",
                          }}
                        >
                          {c.unit}
                        </Box>
                      </Typography>
                    </Stack>
                  ),
                )}
              </Stack>
            </Box>
          </Grid>
        );
      })}
    </Grid>
  );
}

NameFacts.propTypes = {
  facts: PropTypes.object,
  loading: PropTypes.bool,
  columns: PropTypes.number,
};
