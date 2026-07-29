"use client";

import { useState, useEffect } from "react";

import {
  Box,
  Card,
  Table,
  Stack,
  TableRow,
  TableBody,
  TableCell,
  Typography,
  CardContent,
  CircularProgress,
} from "@mui/material";
import {
  CheckCircleRounded as OkIcon,
  CancelRounded as BadIcon,
} from "@mui/icons-material";

import axiosInstance, { endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
// QR‑аас нээгддэг НИЙТИЙН хуудас — лавлагааны дугаараар хүчинтэй эсэхийг шалгана.
// (QR дахин харуулахгүй — зөвхөн хүчинтэй эсэх + мөрүүд.)
// ----------------------------------------------------------------------

const fDate = (v) => (v ? new Date(v).toLocaleString("mn-MN") : "—");
const fDay = (v) => (v ? new Date(v).toLocaleDateString("mn-MN") : "хугацаагүй");

function Row({ label, value }) {
  return (
    <TableRow>
      <TableCell sx={{ color: "text.secondary", width: "45%", border: 0, py: 0.75 }}>
        {label}
      </TableCell>
      <TableCell sx={{ fontWeight: 500, border: 0, py: 0.75 }}>{value ?? "—"}</TableCell>
    </TableRow>
  );
}

export default function InquireVerifyPage({ params }) {
  const code = params?.code;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) return;
    let active = true;
    axiosInstance
      .get(endpoints.geoname.inquireVerify(code))
      .then((res) => {
        if (active) setData(res?.data || null);
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f4f7fb",
        p: 3,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <Card sx={{ maxWidth: 560, width: "100%", mt: 4, borderRadius: 3, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
        <CardContent sx={{ p: 4 }}>
          <Stack alignItems="center" spacing={1} sx={{ mb: 3 }}>
            <Box component="img" src="/assets/logo/logo.svg" alt="" sx={{ height: 56 }} />
            <Typography variant="h6" sx={{ color: "#074481" }}>
              Газар зүйн нэрийн лавлагаа шалгах
            </Typography>
          </Stack>

          {loading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress />
            </Stack>
          ) : notFound || !data?.found ? (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: "#fee2e2",
                color: "#991b1b",
                textAlign: "center",
                fontWeight: 700,
              }}
            >
              ✖ Ийм дугаартай лавлагаа олдсонгүй
            </Box>
          ) : (
            <>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="center"
                spacing={1}
                sx={{
                  p: 1.5,
                  mb: 3,
                  borderRadius: 2,
                  bgcolor: data.valid ? "#dcfce7" : "#fee2e2",
                  color: data.valid ? "#166534" : "#991b1b",
                  fontWeight: 700,
                  fontSize: 18,
                }}
              >
                {data.valid ? <OkIcon /> : <BadIcon />}
                {data.valid ? "Хүчинтэй лавлагаа" : "Хүчингүй / хугацаа дууссан"}
              </Stack>

              <Table size="small">
                <TableBody>
                  <Row label="Лавлагааны дугаар" value={<b>{data.code}</b>} />
                  <Row
                    label="Газар зүйн нэр"
                    value={
                      <>
                        <b>{data.name || "—"}</b>
                        {data.number ? (
                          <Typography component="span" sx={{ color: "text.disabled" }}>
                            {" "}
                            · № {data.number}
                          </Typography>
                        ) : null}
                      </>
                    }
                  />
                  <Row label="Батлагдсан эсэх" value={data.is_approved ? "Тийм" : "Үгүй"} />
                  <Row label="Зориулалт" value={data.purpose || "—"} />
                  <Row label="Үүсгэсэн огноо" value={fDate(data.created_date)} />
                  <Row label="Хүчинтэй хугацаа" value={fDay(data.valid_until)} />
                  <Row label="Хүсэлт гаргасан" value={data.user || "—"} />
                </TableBody>
              </Table>
            </>
          )}

          <Typography
            variant="caption"
            sx={{ display: "block", textAlign: "center", color: "text.secondary", mt: 3 }}
          >
            Газар зохион байгуулалт, геодези, зураг зүйн ерөнхий газар
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
