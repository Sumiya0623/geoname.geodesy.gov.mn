"use client";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import React from "react";
import { useGetPaymentInquire } from "src/api/inquire";
import "../style.css";
import Image from "next/image";

function InquirePaymentView({ id }) {
  const { inquire, inquireError } = useGetPaymentInquire(id);
  const date = new Date();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const hasErrorMessage = inquireError?.response?.data?.results || null;
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        minHeight: "100vh",
        pb: 4,
      }}
    >
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "200px",
          zIndex: -1,
          backgroundImage: "url(/assets/inquire-hee.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <Box
        sx={{
          width: 595,
          px: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "100%",
            pt: 1,
          }}
        >
          <Box>
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 2,
                  mt: 2,
                  flexDirection: "row",
                }}
              >
                <Image
                  src={"/assets/soyombo.svg"}
                  height={80}
                  width={40}
                  alt="soymbo"
                  style={{ flexShrink: 0 }}
                />
                <Typography
                  sx={{
                    fontFamily: "Roboto Slab, serif",
                    color: "#1A4E99",
                    textAlign: "center",
                    fontSize: isMobile ? 14 : 20,
                    fontWeight: "bold",
                    lineHeight: 1.3,
                  }}
                >
                  ТӨРИЙН ҮЙЛЧИЛГЭЭНИЙ НЭГДСЭН СИСТЕМЭЭР ДАМЖУУЛАН МЭДЭЭЛЭЛ
                  ХАРИУЦАГЧААС ОЛГОХ ЛАВЛАГАА, ТОДОРХОЙЛОЛТ
                </Typography>
              </Box>
              <Box sx={{ mt: 4 }}>
                <Typography sx={{ fontSize: "0.6rem", fontWeight: 700 }}>
                  {date.getFullYear()} оны {date.getMonth() + 1}-р сарын{" "}
                  {date.getDate()}-ны өдөр
                </Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0 }}>
                <Typography
                  sx={{
                    textAlign: "right",
                    fontStyle: "italic",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    width: 230,
                  }}
                >
                  Засгийн газрын 2023 оны 3 дугаар сарын 15-ны өдрийн 100 дугаар
                  тогтоолын 3 дугаар хавсралт
                </Typography>
              </Box>
            </Box>
            <Box>
              <Typography
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  mt: 4,
                  mb: 2,
                  fontWeight: "bold",
                  fontSize: 18,
                  textAlign: "center",
                }}
              >
                {inquire?.title}
              </Typography>
            </Box>
            <Box>
              <Typography
                sx={{ textAlign: "center", fontSize: "1rem", lineHeight: 1.6 }}
              >
                {inquire?.description}
              </Typography>
            </Box>
            {hasErrorMessage ? (
              <>
                <Typography
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    fontSize: "1rem",
                  }}
                >
                  {hasErrorMessage}
                </Typography>
              </>
            ) : (
              <>
                <Box sx={{ mt: 2 }}>
                  <Typography
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      fontSize: "1rem",
                    }}
                  >
                    Төлөв:{" "}
                    {inquire?.status === true ? "Идэвхитэй" : "Идэвхигүй"}
                  </Typography>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography
                    sx={{
                      fontWeight: "bold",
                      display: "flex",
                      justifyContent: "center",
                      fontSize: "1rem",
                    }}
                  >
                    Цэг тэмдэгтийн мэдээлэлд үндэслэв.
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default InquirePaymentView;
