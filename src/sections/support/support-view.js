"use client";

import PropTypes from "prop-types";
import { useMemo, useState } from "react";

import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Accordion from "@mui/material/Accordion";
import Pagination from "@mui/material/Pagination";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import CircularProgress from "@mui/material/CircularProgress";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { alpha } from "@mui/material/styles";

import Iconify from "src/components/iconify";
import { mainApi, mainFileUrl } from "src/utils/main-axios";
import { useMainGuides, useMainFaqs } from "src/api/main-support";

import TicketView from "./ticket-view";

// ----------------------------------------------------------------------
// Гарын авлага, түгээмэл асуулт, тусламжийн хүсэлт — бүх агуулга нь төв
// системд (geodesy.gov.mn) бүртгэгддэг. Энд зөвхөн ЭНЭ системд хамаарах
// зааврыг шүүж харуулна. Бүтэц нь төв системийн тусламжийн хуудастай ижил.
// ----------------------------------------------------------------------

const PAGE_SIZE = 10;

function isVideoFile(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return [".mp4", ".webm", ".ogg", ".mov", ".m4v"].some((ext) =>
    lower.endsWith(ext),
  );
}

// Үзсэн тоог төв системд нэмэгдүүлнэ (нэвтрэх шаардлагагүй)
function countView(id) {
  if (id == null) return Promise.resolve();
  return mainApi.get(`/api/news/post/${id}/`).catch(() => {});
}

export default function SupportView({ initialTab = "guide" }) {
  const [tab, setTab] = useState(initialTab);

  const [guideSearch, setGuideSearch] = useState("");
  const [guidePage, setGuidePage] = useState(1);
  const [selectedGuideId, setSelectedGuideId] = useState(null);

  const guideRequest = useMemo(
    () => ({ page: guidePage, page_size: PAGE_SIZE, title: guideSearch || "" }),
    [guidePage, guideSearch],
  );

  const {
    guides,
    guidesLoading,
    guidesTotalPages,
    guidesMutation,
  } = useMainGuides(guideRequest);

  const selectedGuide = useMemo(
    () => guides.find((g) => g.id === selectedGuideId) || guides[0],
    [guides, selectedGuideId],
  );

  const handleSelectGuide = (guide) => {
    if (guide.id == null || guide.id === selectedGuideId) return;
    setSelectedGuideId(guide.id);
    countView(guide.id).then(() => guidesMutation());
  };

  const [faqSearch, setFaqSearch] = useState("");
  const [faqPage, setFaqPage] = useState(1);
  const [expandedFaqId, setExpandedFaqId] = useState(null);

  const faqRequest = useMemo(
    () => ({ page: faqPage, page_size: PAGE_SIZE, title: faqSearch || "" }),
    [faqPage, faqSearch],
  );

  const { faqs, faqsLoading, faqsTotalPages, faqsMutation } =
    useMainFaqs(faqRequest);

  const handleToggleFaq = (faq) => {
    const isOpening = expandedFaqId !== faq.id;
    setExpandedFaqId(isOpening ? faq.id : null);
    if (isOpening) countView(faq.id).then(() => faqsMutation());
  };

  const renderGuideList = (
    <Stack spacing={2}>
      <TextField
        fullWidth
        value={guideSearch}
        onChange={(event) => {
          setGuideSearch(event.target.value);
          setGuidePage(1);
        }}
        placeholder="Зааврын гарчгаар хайх"
      />

      {guidesLoading && !guides.length ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        guides.map((guide) => {
          const title = guide.title || "Гарчиггүй заавар";
          const isActive = selectedGuide?.id === guide.id;
          return (
            <Card
              key={guide.id ?? title}
              role="button"
              tabIndex={0}
              onClick={() => handleSelectGuide(guide)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSelectGuide(guide);
                }
              }}
              sx={{
                p: 1.25,
                cursor: "pointer",
                border: (theme) =>
                  `1px solid ${
                    isActive ? theme.palette.primary.main : theme.palette.divider
                  }`,
                bgcolor: (theme) =>
                  isActive
                    ? alpha(theme.palette.primary.main, 0.08)
                    : "background.paper",
                transition: (theme) =>
                  theme.transitions.create([
                    "border-color",
                    "background-color",
                    "box-shadow",
                    "transform",
                  ]),
                "&:hover, &:focus-visible": {
                  outline: "none",
                  borderColor: "primary.main",
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                  boxShadow: (theme) => theme.customShadows?.z8,
                  transform: "translateX(2px)",
                  "& .guide-arrow": { color: "primary.main" },
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 1,
                    color: isActive ? "common.white" : "primary.main",
                    bgcolor: (theme) =>
                      isActive
                        ? theme.palette.primary.main
                        : alpha(theme.palette.primary.main, 0.1),
                  }}
                >
                  <Iconify icon="mdi:play" width={20} />
                </Box>

                <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight={isActive ? 600 : 500}
                    color={isActive ? "primary" : "text.primary"}
                  >
                    {title}
                  </Typography>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={0.5}
                    sx={{ color: "text.disabled" }}
                  >
                    <Iconify icon="mdi:eye-outline" width={14} />
                    <Typography variant="caption">
                      {guide.views ?? 0} удаа үзсэн
                    </Typography>
                  </Stack>
                </Stack>

                <Iconify
                  className="guide-arrow"
                  icon="mdi:chevron-right"
                  width={22}
                  sx={{
                    flexShrink: 0,
                    color: isActive ? "primary.main" : "text.disabled",
                  }}
                />
              </Stack>
            </Card>
          );
        })
      )}

      {!guidesLoading && !guides.length && (
        <Typography variant="body2" color="text.secondary">
          Одоогоор заавар бүртгэгдээгүй байна.
        </Typography>
      )}

      {guidesTotalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
          <Pagination
            color="primary"
            page={guidePage}
            count={guidesTotalPages}
            onChange={(_, page) => setGuidePage(page)}
          />
        </Box>
      )}
    </Stack>
  );

  const renderGuideDetail = (() => {
    if (guidesLoading && !selectedGuide) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      );
    }

    if (!selectedGuide) {
      return (
        <Typography variant="body2" color="text.secondary">
          Зүүн талаас дэлгэрэнгүй харах заавраа сонгоно уу.
        </Typography>
      );
    }

    const title = selectedGuide.title || "Гарчиггүй заавар";
    const videoUrl = mainFileUrl(selectedGuide.video);
    const fileUrl = mainFileUrl(selectedGuide.file || selectedGuide.url);
    const isVideo = Boolean(videoUrl) || isVideoFile(fileUrl);

    return (
      <Stack spacing={2}>
        <Typography variant="h6">{title}</Typography>

        {videoUrl || fileUrl ? (
          isVideo ? (
            <Box
              component="video"
              src={videoUrl || fileUrl}
              controls
              sx={{
                width: "100%",
                maxHeight: { xs: 240, md: 500 },
                borderRadius: 1,
                bgcolor: "black",
              }}
            />
          ) : (
            <Box
              component="iframe"
              src={fileUrl}
              title={title}
              sx={{
                width: "100%",
                minHeight: { xs: 360, md: 500 },
                borderRadius: 1,
                border: (theme) => `1px solid ${theme.palette.divider}`,
                bgcolor: "background.paper",
              }}
            />
          )
        ) : (
          <Typography variant="body2" color="text.secondary">
            Энэ зааварт холбогдох видео эсвэл PDF файл байхгүй байна.
          </Typography>
        )}
      </Stack>
    );
  })();

  const renderFaqs = (
    <Stack spacing={2}>
      <TextField
        fullWidth
        value={faqSearch}
        onChange={(event) => {
          setFaqSearch(event.target.value);
          setFaqPage(1);
          setExpandedFaqId(null);
        }}
        placeholder="Асуултын гарчгаар хайх"
      />

      {faqsLoading && !faqs.length ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        faqs.map((faq, index) => {
          const question = faq.title || "Асуултын гарчиг";
          const answer =
            faq.answer || faq.desc || "Хариултын мэдээлэл оруулаагүй байна.";
          const isExpanded = expandedFaqId != null && expandedFaqId === faq.id;

          return (
            <Accordion
              key={faq.id ?? index}
              disableGutters
              expanded={isExpanded}
              onChange={() => handleToggleFaq(faq)}
              sx={{
                boxShadow: "none",
                borderRadius: 2,
                border: (theme) =>
                  `1px solid ${
                    isExpanded
                      ? theme.palette.primary.main
                      : theme.palette.divider
                  }`,
                bgcolor: "background.paper",
                "&:before": { display: "none" },
                "&:hover": {
                  borderColor: "primary.main",
                  boxShadow: (theme) => theme.customShadows?.z8,
                },
              }}
            >
              <AccordionSummary
                expandIcon={
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      color: isExpanded ? "common.white" : "primary.main",
                      bgcolor: (theme) =>
                        isExpanded
                          ? theme.palette.primary.main
                          : alpha(theme.palette.primary.main, 0.1),
                    }}
                  >
                    <ExpandMoreIcon fontSize="small" />
                  </Box>
                }
                sx={{
                  px: 2,
                  borderRadius: 2,
                  "&:hover": {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                  },
                  "& .MuiAccordionSummary-content": { my: 1.5 },
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{ flex: 1, minWidth: 0, pr: 1 }}
                >
                  <Iconify
                    icon="mdi:help-circle-outline"
                    width={24}
                    sx={{ flexShrink: 0, color: "primary.main" }}
                  />
                  <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="subtitle1"
                      color={isExpanded ? "primary" : "text.primary"}
                    >
                      {question}
                    </Typography>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={0.5}
                      sx={{ color: "text.disabled" }}
                    >
                      <Iconify icon="mdi:eye-outline" width={14} />
                      <Typography variant="caption">
                        {faq.views ?? 0} удаа үзсэн
                      </Typography>
                    </Stack>
                  </Stack>
                  {!isExpanded && (
                    <Typography
                      variant="caption"
                      sx={{
                        flexShrink: 0,
                        color: "primary.main",
                        fontWeight: 600,
                        display: { xs: "none", sm: "block" },
                      }}
                    >
                      Хариулт харах
                    </Typography>
                  )}
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, pl: { sm: 6.5 }, pb: 2.5 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  component="div"
                  // Агуулга нь төв системийн засварлагчаас ирнэ
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: answer || "" }}
                />
              </AccordionDetails>
            </Accordion>
          );
        })
      )}

      {!faqsLoading && !faqs.length && (
        <Typography variant="body2" color="text.secondary">
          Одоогоор түгээмэл асуулт бүртгэгдээгүй байна.
        </Typography>
      )}

      {faqsTotalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 2 }}>
          <Pagination
            color="primary"
            page={faqPage}
            count={faqsTotalPages}
            onChange={(_, page) => setFaqPage(page)}
          />
        </Box>
      )}
    </Stack>
  );

  return (
    <Stack spacing={{ xs: 2.5, md: 4 }}>
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          "& .MuiTab-root": {
            fontWeight: 600,
            minHeight: 48,
            fontSize: { xs: "0.8rem", sm: "0.875rem" },
            px: { xs: 1.25, sm: 2 },
          },
        }}
      >
        <Tab
          value="guide"
          label="Видео, тайлбар заавар"
          icon={<Iconify icon="mdi:play-box-outline" width={20} />}
          iconPosition="start"
        />
        <Tab
          value="faq"
          label="Түгээмэл асуулт"
          icon={<Iconify icon="mdi:comment-question-outline" width={20} />}
          iconPosition="start"
        />
        <Tab
          value="ticket"
          label="Тусламжийн хүсэлт"
          icon={<Iconify icon="mdi:face-agent" width={20} />}
          iconPosition="start"
        />
      </Tabs>

      {tab === "guide" && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "360px 1fr" },
            gap: 3,
          }}
        >
          {renderGuideList}
          {renderGuideDetail}
        </Box>
      )}

      {tab === "faq" && renderFaqs}

      {tab === "ticket" && <TicketView />}
    </Stack>
  );
}

SupportView.propTypes = {
  initialTab: PropTypes.string,
};
