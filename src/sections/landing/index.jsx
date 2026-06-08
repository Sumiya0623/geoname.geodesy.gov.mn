"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Container,
  Typography,
  Grid,
  Avatar,
} from "@mui/material";

import SvgColor from "src/components/svg-color";
import Link from "next/link";
import { OverviewAppView } from "../overview/app/view";
import { useAuthContext } from "src/auth/hooks";
import ParticleBackground from "src/components/background/ParticleBackground";
import Iconify from "src/components/iconify";
import { useColorStyle } from "src/utils/colorStyles";

export default function Landing() {
  const zaalt = [
    {
      title: "ГЕОДЕЗИ, ЗУРАГ ЗҮЙН ТУХАЙ ХУУЛЬ",
      content: `3 дугаар зүйл:\n
       3.1.6. "геодезийн байнгын цэг, тэмдэгт" гэж геодези, зураг зүйн үйл ажиллагааны үндэс болох байрлал, өндөр, хүндийн хүчний хурдатгал зэрэг орон зайн гурав болон түүнээс дээш хэмжээсээр утга нь тодорхойлогдсон, газрын гадарга, хэвлий, барилга байгууламж зэрэг хөдөлгөөнгүй биетэд бэхлэгдсэн төв болон түүний гаднах тэмдэглээсийг;`,
      color: "#60a5fa",
      borderColor: "rgba(59, 130, 246, 0.3)",
      hoverBorder: "rgba(59, 130, 246, 0.6)",
      shadowColor: "rgba(59, 130, 246, 0.3)",
    },
    {
      title: "ГЕОДЕЗИ, ЗУРАГ ЗҮЙН ТУХАЙ ХУУЛЬ",
      content: `5 дугаар зүйл: \n
       5.8.Аймаг, сум, нийслэл, дүүргийн Засаг дарга геодези, зураг зүйн талаар дараахь бүрэн эрхийг хэрэгжүүлнэ\n
       5.8.2.нутаг дэвсгэртээ хамаарах байр зүйн зураг, зураг зүйн бүтээлд тусгагдах газар зүйн нэр, хил, шинээр байгуулагдсан болон өөрчлөгдсөн объектын талаархи мэдээлэл, геодезийн байнгын цэг, тэмдэгтийн хадгалалт, хамгаалалтанд хяналт тавьж, жил бүр тооллого явуулж дүнг дараа жилийн 2 дугаар сарын 1-ний өдрийн дотор геодези, зураг зүйн асуудал эрхэлсэн төрийн захиргааны байгууллагад мэдээлэх;`,
      color: "#34d399",
      borderColor: "rgba(16, 185, 129, 0.3)",
      hoverBorder: "rgba(16, 185, 129, 0.6)",
      shadowColor: "rgba(16, 185, 129, 0.3)",
    },
    {
      title: "ГЕОДЕЗИ, ЗУРАГ ЗҮЙН ТУХАЙ ХУУЛЬ",
      content: `10 дугаар зүйл.Геодезийн байнгын цэг, тэмдэгт\n
      10.2.Энэ хуулийн 6 дугаар зүйлд заасан байгууллага, аж ахуйн нэгж, иргэн геодезийн байнгын цэг, тэмдэгт байрлуулсан бол уг цэг, тэмдэгтийн байрлаж байгаа сум, дүүргийн Засаг даргад, хилийн зурваст бол хил хамгаалах ерөнхий газрын харьяа тусгай ангийн удирдлагад хүлээлгэж өгнө.
      10.3.Байгууллага, аж ахуйн нэгж, иргэн нь геодезийн байнгын цэг, тэмдэгт байрлаж байгаа газарт барилга байгууламж барих, газар шорооны ажил хийхдээ сум, дүүргийн Засаг дарга буюу хил хамгаалах ерөнхий газраар уламжлан геодези, зураг зүйн асуудал эрхэлсэн төрийн захиргааны байгууллагаас зөвшөөрөл авна. Уг цэг, тэмдэгтийг хөдөлгөх, нүүлгэн шилжүүлэх зайлшгүй шаардлага гарвал түүнийг сэргээн босгох зардлыг хүсэлт гаргасан байгууллага, аж ахуйн нэгж, иргэн хариуцна.
      `,
      color: "#60a5fa",
      borderColor: "rgba(59, 130, 246, 0.3)",
      hoverBorder: "rgba(59, 130, 246, 0.6)",
      shadowColor: "rgba(59, 130, 246, 0.3)",
    },
    {
      title: "ГЕОДЕЗИ, ЗУРАГ ЗҮЙН ТУХАЙ ХУУЛЬ",
      content: `10 дугаар зүйл.Геодезийн байнгын цэг, тэмдэгт\n
      10.2.Энэ хуулийн 6 дугаар зүйлд заасан байгууллага, аж ахуйн нэгж, иргэн геодезийн байнгын цэг, тэмдэгт байрлуулсан бол уг цэг, тэмдэгтийн байрлаж байгаа сум, дүүргийн Засаг даргад, хилийн зурваст бол хил хамгаалах ерөнхий газрын харьяа тусгай ангийн удирдлагад хүлээлгэж өгнө.
      10.3.Байгууллага, аж ахуйн нэгж, иргэн нь геодезийн байнгын цэг, тэмдэгт байрлаж байгаа газарт барилга байгууламж барих, газар шорооны ажил хийхдээ сум, дүүргийн Засаг дарга буюу хил хамгаалах ерөнхий газраар уламжлан геодези, зураг зүйн асуудал эрхэлсэн төрийн захиргааны байгууллагаас зөвшөөрөл авна. Уг цэг, тэмдэгтийг хөдөлгөх, нүүлгэн шилжүүлэх зайлшгүй шаардлага гарвал түүнийг сэргээн босгох зардлыг хүсэлт гаргасан байгууллага, аж ахуйн нэгж, иргэн хариуцна.
      `,
      color: "#60a5fa",
      borderColor: "rgba(59, 130, 246, 0.3)",
      hoverBorder: "rgba(59, 130, 246, 0.6)",
      shadowColor: "rgba(59, 130, 246, 0.3)",
    },
    {
      title: "КАДАСТРЫН ЗУРАГЛАЛ БА ГАЗРЫН КАДАСТРЫН ТУХАЙ",
      content: `19 дүгээр зүйл.Кадастрын зураглалын талаар хориглох үйл ажиллагаа\n
      19.1.1.эзэмшиж, ашиглаж байгаа газартаа геодезийн цэг, тэмдэгт болон эдлэн газрын хил заагийн тэмдэглээсийг гэмтээх, устгах, зохих зөвшөөрөлгүй нүүлгэн шилжүүлэх;`,
      color: "#34d399",
      borderColor: "rgba(16, 185, 129, 0.3)",
      hoverBorder: "rgba(16, 185, 129, 0.6)",
      shadowColor: "rgba(16, 185, 129, 0.3)",
    },

    {
      title: "МОНГОЛ УЛСЫН ИРГЭНД ГАЗАР ӨМЧЛҮҮЛЭХ ТУХАЙ",
      content: `27 дугаар зүйл.Газар өмчлөгч иргэний эрх, үүрэг\n
      27.2.4.өмчийн газар дээр нь байрлуулсан заагийн болон геодезийн цэг, тэмдэгтийг хамгаалах, бүрэн бүтэн байлгах;\n
      33 дугаар зүйл.Газар өмчлөгч иргэний эрхийг хязгаарлах эрх (сервитут)\n
      33.1.2.уг газарт газрын заагийн болон геодезийн байнгын цэг, тэмдэгт тавих;`,
      color: "#f87171",
      borderColor: "rgba(239, 68, 68, 0.3)",
      hoverBorder: "rgba(239, 68, 68, 0.6)",
      shadowColor: "rgba(239, 68, 68, 0.3)",
    },

    {
      title: "ГЕОДЕЗИЙН БАЙНГЫН ЦЭГ ТЭМДЭГТ БАЙГУУЛАХ ДҮРЭМ БД 11-104-19",
      content: `48 дугаар зүйл: \n
      48.2.Энэ хуулийн 48.1.2-т заасан тайланд тухайн талбайд хийгдсэн тойм судалгаа, геофизик, геохими, өрөмдлөг болон бусад бүх төрлийн ажлын тоо хэмжээ, өртөг, зардал, ажиллах хүчтэй холбогдсон мэдээ, түүнчлэн хайгуулын ажлын үр дүн, тухайн талбайд хийгдсэн ажлын зургийг хавсаргах бөгөөд түүнийг улсын геодезийн зураглалын тулгуур сүлжээтэй холбосон байна.`,
      color: "#f87171",
      borderColor: "rgba(239, 68, 68, 0.3)",
      hoverBorder: "rgba(239, 68, 68, 0.6)",
      shadowColor: "rgba(239, 68, 68, 0.3)",
    },
  ];
  const { authenticated, loading } = useAuthContext();
  const flatMenu = useMemo(() => {
    const staticMenu = [
      {
        name: "Хэрэглэгчийн мэдээлэл",
        order: 2,
        submenus: [
          {
            name: "Систем ашиглах",
            icon: "ic_point",
            path: "/dashboard",
            idx: 2,
          },
          {
            name: "Портал руу шилжих",
            icon: "ic_lock",
            path: process.env.NEXT_PUBLIC_PORTAL_URL || "/login",
            idx: 5,
          },
        ],
      },
    ];

    const guestMenu = [
      {
        name: "Хэрэглэгчийн мэдээлэл",
        order: 2,
        submenus: [
          {
            name: "Нэвтрэх",
            icon: "ic_role",
            path: process.env.NEXT_PUBLIC_PORTAL_URL || "/login",
            idx: 2,
          },
          {
            name: "Портал руу шилжих",
            icon: "ic_lock",
            path: process.env.NEXT_PUBLIC_PORTAL_URL || "/login",
            idx: 5,
          },
        ],
      },
    ];

    return (authenticated ? staticMenu : guestMenu).flatMap(
      (menu) =>
        menu.submenus?.map((submenu) => ({
          ...submenu,
          parent: menu.name,
        })) || [],
    );
  }, [authenticated]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <ParticleBackground />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
        }}
      >
        {/* Animated Grid */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            opacity: 0.1,
            backgroundSize: "60px 60px",
            animation: "pulse 4s infinite",
          }}
        />

        {/* Glowing Orbs */}
        <Box
          sx={{
            position: "absolute",
            top: "10%",
            left: "20%",
            width: "300px",
            height: "300px",
            background:
              "radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(40px)",
            animation: "float 6s ease-in-out infinite",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            bottom: "20%",
            right: "15%",
            width: "250px",
            height: "250px",
            background:
              "radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 60%)",
            borderRadius: "50%",
            filter: "blur(40px)",
            animation: "float 8s ease-in-out infinite reverse",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: "60%",
            left: "70%",
            width: "200px",
            height: "200px",
            background:
              "radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(40px)",
            animation: "float 7s ease-in-out infinite",
          }}
        />

        {/* Scanning Lines */}
        <Box
          sx={{
            position: "absolute",
            top: "30%",
            left: 0,
            width: "100%",
            height: "2px",
            background:
              "linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.6), transparent)",
            animation: "scan 3s linear infinite",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: "70%",
            left: 0,
            width: "100%",
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.4), transparent)",
            animation: "scan 4s linear infinite reverse",
          }}
        />
      </Box>

      <Container maxWidth="xl" sx={{ position: "relative", zIndex: 10, py: 6 }}>
        <Typography
          variant="h3"
          sx={{
            color: "common.white",
            fontSize: "1rem",
            mb: 1,
            textAlign: "center",
          }}
        >
          Газар зүйн нэрийн дэд систем
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: "rgba(255, 255, 255, 0.7)",
            fontSize: "0.9rem",
            mb: 4,
            textAlign: "center",
            fontStyle: "italic",
          }}
        >
          Доорхи холбоос дээр дарж үргэлжлүүлнэ үү
        </Typography>
        <Grid
          container
          sx={{
            mb: 4,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {flatMenu.map((link, index) => (
            <MenuCard key={index} link={link} index={index} />
          ))}
        </Grid>
        <OverviewAppView calling={true} />
        <Box
          sx={{
            overflow: "hidden",
            width: "100%",
            position: "relative",
            py: 4,
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: 6,
              width: "max-content",
              animation: "slideText 60s linear infinite",
              "&:hover": {
                animationPlayState: "paused",
              },
            }}
          >
            {[...zaalt, ...zaalt, ...zaalt].map((textCard, indx) => (
              <Card
                key={indx}
                sx={{
                  minWidth: "400px",
                  maxWidth: "400px",
                  background:
                    "linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))",
                  border: `1px solid ${textCard.borderColor}`,
                  borderRadius: 4,
                  p: 2,
                  backdropFilter: "blur(20px)",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    borderColor: textCard.hoverBorder,
                    boxShadow: `0 20px 40px -10px ${textCard.shadowColor}`,
                    transform: "translateY(-4px)",
                  },
                }}
              >
                <CardContent>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 500,
                      mb: 2,
                      background: `linear-gradient(135deg, ${textCard.color}, ${textCard.color}CC)`,
                      backgroundClip: "text",
                      WebkitBackgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    {textCard.title}
                  </Typography>
                  <Typography
                    sx={{
                      whiteSpace: "pre-line",
                      color: "#cbd5e1",
                      lineHeight: 1.2,
                      fontSize: "1rem",
                      mb: 1,
                      textAlign: "justify",
                    }}
                  >
                    {textCard.content}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      </Container>

      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        @keyframes scan {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes slideText {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </Box>
  );
}

function MenuCard({ link, index }) {
  const idx = link?.idx ?? index;
  const colorStyle = useColorStyle(idx);
  const { authenticated, user } = useAuthContext();

  const isDashboardLink = link?.path === "/dashboard";

  return (
    <Grid
      item
      xs={12}
      sm={6}
      md={4}
      lg={3}
      sx={{ width: "400px", margin: "24px" }}
    >
      <Link
        href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}${link?.path || ""}`}
        style={{ textDecoration: "none" }}
      >
        <Card
          sx={{
            height: "100%",
            background:
              "linear-gradient(135deg, rgba(27, 90, 82, 0.05), rgba(255, 255, 255, 0.05))",
            border: "1px solid rgba(160, 160, 160, 0.2)",
            borderRadius: 4,
            cursor: "pointer",
            transition: "all 0.5s ease",
            position: "relative",
            overflow: "hidden",
            backdropFilter: "blur(10px)",
            "&:hover": {
              borderColor: `${colorStyle?.glow}80`,
              transform: "translateY(-8px) scale(1.02)",
              boxShadow: `0 25px 50px -12px ${colorStyle?.glow}60`,
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))",
            },
            "&:hover .icon-container": {
              transform: "scale(1.1) rotate(5deg)",
              boxShadow: `0 20px 40px -10px ${colorStyle?.glow}80`,
            },
            "&:hover .card-title": {
              background: `linear-gradient(135deg, ${colorStyle?.glow}, #ffffff)`,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
            },
            "&:hover .glow-effect": {
              opacity: 1,
            },
            "&:hover .chevron-btn": {
              transform: "translateX(6px) scale(1.15)",
              backgroundColor: `${colorStyle?.color}60`,
              boxShadow: `0 6px 16px ${colorStyle?.glow}40`,
            },
          }}
        >
          <Box
            className="glow-effect"
            sx={{
              position: "absolute",
              inset: -2,
              background: `linear-gradient(135deg, ${colorStyle?.glow}20, transparent, ${colorStyle?.glow}20)`,
              borderRadius: 4,
              opacity: 0,
              transition: "opacity 0.5s ease",
              zIndex: -1,
            }}
          />

          <Box
            sx={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 2,
              display: "flex",
              gap: 1,
            }}
          ></Box>

          <CardHeader
            sx={{ pb: 1 }}
            title={
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box
                    className="icon-container"
                    sx={{
                      width: 48,
                      height: 48,
                      background: colorStyle?.color,
                      borderRadius: 3,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.5s ease",
                      boxShadow: `0 15px 30px -5px ${colorStyle?.glow}40`,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.2), transparent)",
                        animation: "shimmer 2s linear infinite",
                      }}
                    />
                    {isDashboardLink && authenticated && user?.full_name ? (
                      <Avatar
                        src={
                          user?.photo
                            ? user.photo.startsWith("http")
                              ? user.photo
                              : `${process.env.NEXT_PUBLIC_HOST_API}${user.photo}`
                            : undefined
                        }
                        alt={user?.full_name}
                        sx={{
                          width: 1,
                          height: 1,
                          borderRadius: 2.5,
                          border: "2px solid rgba(255, 255, 255, 0.6)",
                          boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.25)",
                          bgcolor: "rgba(255, 255, 255, 0.15)",
                          color: "common.white",
                          fontWeight: 600,
                        }}
                      >
                        {user?.full_name?.charAt(0).toUpperCase()}
                      </Avatar>
                    ) : (
                      <SvgColor
                        src={`/assets/icons/navbar/${link?.icon}.svg`}
                        sx={{ width: 1, height: 1, color: "common.white" }}
                      />
                    )}
                  </Box>
                  {isDashboardLink && authenticated && user?.full_name && (
                    <Box sx={{ display: "flex", flexDirection: "column" }}>
                      <Typography
                        variant="body2"
                        sx={{ color: "#e2e8f0", lineHeight: 1.2 }}
                      >
                        Сайн байна уу
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "#e2e8f0", lineHeight: 1.2 }}
                      >
                        {user.full_name}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box
                  className="chevron-btn"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    color: "#ffffff",
                    fontSize: "1.2rem",
                    transition: "all 0.4s ease",
                    cursor: "pointer",
                    transform: "translateX(0) scale(1)",
                    "&:hover": {
                      transform: "translateX(4px) scale(1.1)",
                      backgroundColor: `${colorStyle?.color}40`,
                      boxShadow: `0 4px 12px ${colorStyle?.glow}30`,
                    },
                  }}
                >
                  <Iconify icon="carbon:chevron-right" />
                </Box>
              </Box>
            }
            subheader={
              <Typography
                variant="h6"
                sx={{
                  color: "#f1f5f9",
                  fontWeight: 700,
                  mt: 1,
                }}
              >
                {link?.name}
              </Typography>
            }
          />
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "4px",
              background: colorStyle?.color,
              transform: "scaleX(0)",
              transformOrigin: "left",
              transition: "transform 0.5s ease",
              ".MuiCard-root:hover &": {
                transform: "scaleX(1)",
              },
            }}
          />
        </Card>
      </Link>
    </Grid>
  );
}
