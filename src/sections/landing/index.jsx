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
import NotificationsPopover from "src/layouts/common/notifications-popover";
import NameStatSection from "./name-stat";

export default function Landing() {
  const zaalt = [
    {
      title: "ГЕОДЕЗИ, ЗУРАГ ЗҮЙН ТУХАЙ ХУУЛЬ",
      content: `11 дүгээр зүйл.Газар зүйн нэр:\n
       11.1.Байгууллага, аж ахуйн нэгж, иргэдийг газар зүйн албан ёсны нэрийн тухай мэдээллээр хангах, газар зүйн нэрийг зөв бичих, хэрэглэх, хамгаалах асуудлыг сум, дүүргийн Засаг дарга, геодези, зураг зүйн асуудал эрхэлсэн төрийн захиргааны байгууллага эрхлэн хамтран зохицуулна.\n
       11.3.Газар зүйн нэрэнд дараахь обьектын нэр хамаарна:\n
11.3.1.эх газар, далай, тэнгис, булан, тохой, арал, хойг, уул, нуруу, хээр, тал, говь, цөл, мөрөн, гол, нуур зэрэг физик газар зүйн объект;\n
11.3.2.хүний үйл ажиллагаагаар бий болсон далан, усан сан, суваг, шуудуу;\n
11.3.3.улс, засаг захиргаа, нутаг дэвсгэрийн нэгж, тэдгээрийн доторх хөдөө аж ахуй, үйлдвэр, тээвэр, холбоо зэрэг бусад объект.
       `,
      color: "#60a5fa",
      borderColor: "rgba(59, 130, 246, 0.3)",
      hoverBorder: "rgba(59, 130, 246, 0.6)",
      shadowColor: "rgba(59, 130, 246, 0.3)",
    },
    {
      title: "ГАЗРЫН ТУХАЙ ХУУЛЬ",
      content: `8 дугаар зүйл.Хилийн цэс, газар усны нэр, газар усны нэрийн болон газрын сангийн зураг\n
       8.1.Аймаг, сум, нийслэл, дүүрэг бүр хилийн цэс, газар усны нэрийн болон газрын сангийн зурагтай байна.\n
       8.2.Хилийн цэс, газар усны нэрийг Улсын Их Хурал, газрын сангийн зургийг газрын асуудал эрхэлсэн төрийн захиргааны байгууллага /цаашид "Засгийн газрын эрх бүхий байгууллага" гэнэ/ тус тус батална.\n
       8.6.Албан ёсны баримт бичиг болон арга хэмжээнд газар усны давхар нэр хэрэглэх, газар усны албан ёсны нэрийг монгол хэлнээс бусад хэлээр орчуулах, бусад хэлний дуудлагаар галиглан бичихийг хориглоно.`,
      color: "#60a5fa",
      borderColor: "rgba(59, 130, 246, 0.3)",
      hoverBorder: "rgba(59, 130, 246, 0.6)",
      shadowColor: "rgba(59, 130, 246, 0.3)",
    },
    {
      title:
        "МОНГОЛ УЛСЫН ЗАСАГ ЗАХИРГАА, НУТАГ ДЭВСГЭРИЙН НЭГЖ, ТҮҮНИЙ УДИРДЛАГЫН ТУХАЙ",
      content: `14 дүгээр зүйл.Аймаг, сум, нийслэл, дүүргийн хилийн цэс, баг, хорооны нутаг дэвсгэрийн зааг\n
       14.3.Монгол Улсын засаг захиргааны нэгжийн оноосон болон нэгж дэх газар зүйн нэр, гудамж, зам, талбайг төрийн албан ёсны хэлээр нэрлэнэ.
`,
      color: "#60a5fa",
      borderColor: "rgba(59, 130, 246, 0.3)",
      hoverBorder: "rgba(59, 130, 246, 0.6)",
      shadowColor: "rgba(59, 130, 246, 0.3)",
    },
    {
      title: "ЗӨРЧЛИЙН ТУХАЙ",
      content: `11.Газрын тухай хуульд заасныг зөрчиж:\n
      11.1.албан ёсны баримт бичиг, арга хэмжээнд газар усны давхар нэр хэрэглэсэн;\n
11.2.газар усны албан ёсны нэрийг монгол хэлнээс бусад хэлээр орчуулсан, эсхүл бусад хэлний дуудлагаар галиглан бичсэн бол хүнийг гурван зуун нэгжтэй тэнцэх хэмжээний төгрөгөөр, хуулийн этгээдийг гурван мянган нэгжтэй тэнцэх хэмжээний төгрөгөөр торгоно.\n
2.Монгол хэлний тухай хуулиар тогтоосон:\n
2.1.хот, суурин газрын гудамж, талбайн нэр, хаяг, төрийн байгууллагын нэрийг төрийн албан ёсны хэлээр бичих;

`,
      color: "#60a5fa",
      borderColor: "rgba(59, 130, 246, 0.3)",
      hoverBorder: "rgba(59, 130, 246, 0.6)",
      shadowColor: "rgba(59, 130, 246, 0.3)",
    },
    {
      title:
        "ГАЗАР ЗҮЙН НЭРИЙН ЖАГСААЛТ БАТЛАХ ТУХАЙ МОНГОЛ УЛСЫН ИХ ХУРЛЫН 2003 оны 42 дугаар ТОГТООЛ",
      content: `
      1."Монгол Улсын нутаг дэвсгэрийн газар зүйн нэрийн жагсаалт"-ыг хавсралтаар баталсугай.\n
      2.Монгол Улсын Засгийн газар /Н.Энхбаяр/-т даалгах нь:\n
1/Газар зүйн нэрийн жагсаалтыг судалгаанд хэрэглэх, албан хэрэг, олон нийтийн мэдээллийн хэрэгсэлд мөрдүүлэх, гадаад улс, олон улсын байгууллагатай нэр солилцох, мэдээлэх зэрэгт ашиглаж байх;\n
2/Газар зүйн нэрийн жагсаалтыг 4 жил тутам тодотгож, Улсын Их Хурлаар батлуулах.
      `,
      color: "#f87171",
      borderColor: "rgba(239, 68, 68, 0.3)",
      hoverBorder: "rgba(239, 68, 68, 0.6)",
      shadowColor: "rgba(239, 68, 68, 0.3)",
    },
    {
      title:
        "НУТАГ ОРНЫ ГАЗАР ЗҮЙН НЭРИЙГ ХАМГААЛАХ ТУХАЙ МОНГОЛ УЛСЫН ЕРӨНХИЙЛӨГЧИЙН 2017 оны 186 дугаар ЗАРЛИГ",
      content: `
      1. Монгол Улсын Их Хурлын 2003 оны 10 дугаар сарын 31-ний өдрийн 42 дугаар тогтоолоор баталсан "Монгол Улсын нутаг дэвсгэрийн газар зүйн нэрийн жагсаалт" дахь газар усны газар зүйн нэрийг албан хэрэг, олон нийтийн мэдээллийн хэрэгсэлд мөрдүүлэх, тухайн орон нутагтаа ард иргэдийн дунд сэргээн хэвшүүлэх, цаашид хууль бусаар газар орны нэр өөрчлөх гэмт явдалтай хууль тогтоомжийн дагуу тууштай тэмцэхийг бүх шатны Засаг дарга нарт үүрэг болгосугай.\n
      2. Уул ус, газар нутгаа эрх бүхий байгууллагаас баталсан нэрээр зөв нэрлэж занших, өөрчлөн буруу нэршихээс сэргийлэх, монгол хэлнээс бусад хэлээр орчуулах буюу бусад хэлний дуудлагаар галиглахгүй байхыг Монгол Улсын нийт иргэд, байгууллагад уриалсугай.
      `,
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

        <Grid
          container
          sx={{
            mb: 2,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {flatMenu.map((link, index) => (
            <MenuCard key={index} link={link} index={index} />
          ))}
        </Grid>
        <OverviewAppView calling={true} />
        <NameStatSection />
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
        @keyframes bellPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.55);
          }
          70% {
            box-shadow: 0 0 0 12px rgba(248, 113, 113, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(248, 113, 113, 0);
          }
        }
        @keyframes bellSwing {
          0%,
          60%,
          100% {
            transform: rotate(0deg);
          }
          70% {
            transform: rotate(12deg);
          }
          80% {
            transform: rotate(-10deg);
          }
          90% {
            transform: rotate(6deg);
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

// Уншаагүй мэдэгдэлтэй үед хонх улаанаар анивчиж, тоо нь харагдана.
// (badge хоосон үед MUI нь .MuiBadge-invisible класс нэмдэг тул :has()-ээр ялгав)
// "Сайн байна уу"-гийн ард суух жижиг мэдэгдлийн тэмдэг. Уншаагүй байвал
// улаанаар анивчиж, тоог нь badge-ээр харуулна. (badge хоосон үед MUI нь
// .MuiBadge-invisible класс нэмдэг тул :has()-ээр ялгав)
const bellSx = {
  display: "inline-flex",
  verticalAlign: "middle",
  ml: 0.75,
  "& .MuiIconButton-root": {
    width: 26,
    height: 26,
    p: 0,
    color: "#cbd5e1",
    transition: "all 0.35s ease",
    "&:hover": { color: "#ffffff", transform: "scale(1.15)" },
  },
  "& .MuiIconButton-root:has(.MuiBadge-badge:not(.MuiBadge-invisible))": {
    color: "#fca5a5",
  },
  "& .MuiIconButton-root:has(.MuiBadge-badge:not(.MuiBadge-invisible)) svg": {
    animation: "bellSwing 2.2s ease-in-out infinite",
    transformOrigin: "50% 10%",
  },
  "& .MuiIconButton-root:has(.MuiBadge-badge:not(.MuiBadge-invisible)) .MuiBadge-badge":
    {
      animation: "bellPulse 2.2s infinite",
    },
  "& .MuiBadge-badge": {
    top: 2,
    right: 1,
    fontWeight: 700,
    fontSize: 9.5,
    minWidth: 16,
    height: 16,
    padding: "0 4px",
    boxShadow: "0 0 0 2px rgba(11, 31, 69, 0.95)",
  },
  "& svg": { width: 18, height: 18 },
};

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
                          boxShadow:
                            "inset 0 0 0 1px rgba(255, 255, 255, 0.25)",
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
                        {authenticated && (
                          <Box
                            component="span"
                            onClick={(e) => {
                              // Мэдэгдэл дархад картын холбоос руу шилжихгүй
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            sx={bellSx}
                          >
                            <NotificationsPopover />
                          </Box>
                        )}
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
