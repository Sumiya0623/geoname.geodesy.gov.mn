"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "src/routes/hooks";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { useAuthContext } from "src/auth/hooks";
import { useGetTicket, useGetTickets, useGetTicketStats } from "src/api/main-support";

import Iconify from "src/components/iconify";

import TicketForm from "./ticket-form";
import TicketList from "./ticket-list";
import TicketDetail from "./ticket-detail";

// ----------------------------------------------------------------------

const PAGE_SIZE = 10;

export default function TicketView() {
  const { user, loading: authLoading } = useAuthContext();
  const params = useSearchParams();

  // Имэйлийн холбоосоор орж ирсэн үед нэвтрэлтгүй харах түлхүүр
  const token = params.get("token") || "";
  const ticketParam = params.get("ticket");

  const [selectedId, setSelectedId] = useState(null);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (ticketParam) setSelectedId(ticketParam);
  }, [ticketParam]);

  // mine=true — энэ хуудсанд ЗӨВХӨН өөрийн үүсгэсэн хүсэлт, түүний тоо
  // харагдана (хариуцагч/админ ч гэсэн бусдын хүсэлтийг эндээс харахгүй)
  const requestBody = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      ordering: "-created_date",
      mine: true,
    }),
    [page],
  );

  const { tickets, ticketsLoading, ticketsTotalPages, ticketsMutation } =
    useGetTickets(requestBody, Boolean(user));

  const { stats, statsMutation } = useGetTicketStats(
    { mine: true },
    Boolean(user),
  );

  const { ticket, ticketLoading, ticketMutation } = useGetTicket(
    selectedId,
    token,
  );

  // Жагсаалт ачаалагдмагц эхний хүсэлтийг сонгоно
  useEffect(() => {
    if (!selectedId && tickets.length) {
      setSelectedId(tickets[0].id);
    }
  }, [tickets, selectedId]);

  const refreshAll = () => {
    ticketMutation?.();
    ticketsMutation?.();
    statsMutation?.();
  };

  const handleCreated = (created) => {
    setShowForm(false);
    setSelectedId(created?.id ?? null);
    refreshAll();
  };

  // Төлөв бүрийн тоо — нэг мөрөнд багтах авсаархан хэлбэрээр
  const renderStats = stats && (
    <Stack
      direction="row"
      alignItems="center"
      flexWrap="wrap"
      divider={
        <Box
          sx={{
            width: "1px",
            height: 12,
            bgcolor: "divider",
            mx: 1.25,
          }}
        />
      }
    >
      {stats.status?.map((item) => (
        <Stack
          key={item.key}
          direction="row"
          spacing={0.5}
          alignItems="baseline"
        >
          <Typography variant="caption" color="text.secondary">
            {item.label}
          </Typography>
          <Typography variant="caption" fontWeight={700}>
            {item.count}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );

  // Нэвтрээгүй, түлхүүргүй үед зөвхөн форм харагдана
  const anonymous = !authLoading && !user && !token;

  return (
    <Stack spacing={3}>
      {!anonymous && (
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          spacing={1}
        >
          {/* Тоо ачаалагдаагүй үед ч товч баруун талдаа байрлана */}
          <Box sx={{ flexGrow: 1 }}>{renderStats}</Box>
          <Button
            variant={showForm ? "outlined" : "contained"}
            size="small"
            startIcon={
              <Iconify icon={showForm ? "eva:close-fill" : "eva:plus-fill"} />
            }
            onClick={() => setShowForm((prev) => !prev)}
          >
            {showForm ? "буцах" : "Шинэ хүсэлт"}
          </Button>
        </Stack>
      )}

      {params.get("rated") && (
        <Alert severity="success">
          Үнэлгээ өгсөнд баярлалаа. Таны санал бидэнд чухал.
        </Alert>
      )}

      {anonymous ? (
        <Card
          sx={{
            p: { xs: 2, md: 3 },
            boxShadow: "none",
            border: (t) => `1px solid ${t.palette.divider}`,
          }}
        >
          <TicketForm onCreated={handleCreated} />
        </Card>
      ) : (
        <>
          {showForm && (
            <Card
              sx={{
                p: { xs: 2, md: 3 },
                boxShadow: "none",
                border: (t) => `1px solid ${t.palette.divider}`,
              }}
            >
              <TicketForm onCreated={handleCreated} />
            </Card>
          )}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
              gap: 3,
              alignItems: "start",
            }}
          >
            <TicketList
              tickets={tickets}
              loading={ticketsLoading}
              selectedId={selectedId}
              onSelect={(item) => setSelectedId(item.id)}
              page={page}
              totalPages={ticketsTotalPages}
              onPageChange={setPage}
            />
            <TicketDetail
              ticket={ticket}
              loading={ticketLoading}
              onRefresh={refreshAll}
              token={token}
            />
          </Box>
        </>
      )}
    </Stack>
  );
}
