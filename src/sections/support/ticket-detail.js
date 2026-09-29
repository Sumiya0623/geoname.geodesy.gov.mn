"use client";

import { useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LoadingButton from "@mui/lab/LoadingButton";
import CircularProgress from "@mui/material/CircularProgress";

import { mainFileUrl } from "src/utils/main-axios";
import { fDateTime } from "src/utils/format-time";
import {
  replyTicket,
  rateTicket,
  TICKET_STATUS,
  TICKET_RATING,
  TICKET_PRIORITY,
} from "src/api/main-support";

import Iconify from "src/components/iconify";
import ProfileAvatar from "src/components/profile-avatar";
import TicketEditor from "src/components/ticket-editor";
import { useSnackbar } from "src/components/snackbar";

// ----------------------------------------------------------------------

function fileUrl(path) {
  // Хавсралт нь төв системд хадгалагддаг
  return mainFileUrl(path);
}

// Rich-text агуулга үнэхээр текст агуулж байгаа эсэх
function hasText(html) {
  return Boolean(
    String(html || "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim(),
  );
}

// Мессежийн HTML агуулгын загвар (хүснэгт, зураг, жагсаалт)
const TICKET_BODY_SX = {
  typography: "body2",
  wordBreak: "break-word",
  "& p": { m: 0, mb: 1 },
  "& p:last-child": { mb: 0 },
  "& img": { maxWidth: "100%", height: "auto", borderRadius: 1 },
  "& table": {
    borderCollapse: "collapse",
    width: "100%",
    my: 1,
    "& td, & th": {
      border: (theme) => `1px solid ${theme.palette.divider}`,
      p: 0.75,
    },
  },
  "& ul, & ol": { pl: 3, m: 0, mb: 1 },
  "& a": { color: "primary.main" },
};

// ----------------------------------------------------------------------

export default function TicketDetail({ ticket, loading, onRefresh, token }) {
  const { enqueueSnackbar } = useSnackbar();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(null);

  if (loading && !ticket) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!ticket) {
    return (
      <Typography variant="body2" color="text.secondary">
        Зүүн талаас хүсэлтээ сонгож дэлгэрэнгүйг харна уу.
      </Typography>
    );
  }

  const status = TICKET_STATUS[ticket.status] || {};
  const priority = TICKET_PRIORITY[ticket.priority] || {};
  const isClosed = ticket.status === "closed";

  const handleReply = async () => {
    if (!hasText(body)) {
      enqueueSnackbar("Агуулгаа бичнэ үү.", { variant: "error" });
      return;
    }
    setSending(true);
    try {
      await replyTicket(ticket.id, body, files);
      setBody("");
      setFiles([]);
      enqueueSnackbar("Мэдээлэл нэмэгдлээ.");
      onRefresh?.();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.error || "Илгээхэд алдаа гарлаа.",
        { variant: "error" },
      );
    } finally {
      setSending(false);
    }
  };

  const handleRate = async (value) => {
    setRating(value);
    try {
      await rateTicket(ticket.id, value, "", token);
      enqueueSnackbar("Үнэлгээ өгсөнд баярлалаа.");
      onRefresh?.();
    } catch (error) {
      setRating(null);
      enqueueSnackbar(
        error?.response?.data?.error || "Үнэлгээ хадгалахад алдаа гарлаа.",
        { variant: "error" },
      );
    }
  };

  const renderDetails = (
    <Card
      sx={{
        p: 2,
        boxShadow: "none",
        border: (t) => `1px solid ${t.palette.divider}`,
      }}
    >
      <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
        Хүсэлтийн мэдээлэл
      </Typography>
      <Stack spacing={1.25}>
        {[
          ["Дугаар", `#${ticket.number}`],
          ["Систем", ticket.system?.title || "-"],
          ["Илгээгч", ticket.email],
          ["Хариуцагч", ticket.assigned_name || "-"],
          ["Бүртгэсэн", fDateTime(ticket.created_date)],
          ["Сүүлийн хариу", fDateTime(ticket.last_reply_date)],
        ].map(([label, value]) => (
          <Stack key={label} spacing={0.25}>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="body2">{value}</Typography>
          </Stack>
        ))}

        <Stack spacing={0.25}>
          <Typography variant="caption" color="text.secondary">
            Төлөв
          </Typography>
          <Box>
            <Chip
              size="small"
              label={ticket.status_label || status.label}
              color={status.color || "default"}
            />
          </Box>
        </Stack>

        <Stack spacing={0.25}>
          <Typography variant="caption" color="text.secondary">
            Хугацаа
          </Typography>
          <Box>
            <Chip
              size="small"
              variant="outlined"
              label={ticket.priority_label || priority.label}
              color={priority.color || "default"}
            />
          </Box>
        </Stack>
      </Stack>
    </Card>
  );

  const renderRating = isClosed && (
    <Card
      sx={{
        p: 2,
        boxShadow: "none",
        border: (t) => `1px solid ${t.palette.divider}`,
      }}
    >
      {ticket.rating ? (
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Таны үнэлгээ</Typography>
          <Typography variant="body2" color="text.secondary">
            {ticket.rating_label}
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">
            Манай үйлчилгээний талаар та юу бодож байна?
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="space-around">
            {TICKET_RATING.map((item) => (
              <Stack
                key={item.value}
                spacing={0.5}
                alignItems="center"
                onClick={() => handleRate(item.value)}
                sx={{
                  cursor: "pointer",
                  width: 110,
                  opacity: rating && rating !== item.value ? 0.4 : 1,
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    border: `3px solid ${item.color}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                  }}
                >
                  {item.icon}
                </Box>
                <Typography
                  variant="caption"
                  align="center"
                  color="text.secondary"
                >
                  {item.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}
    </Card>
  );

  const renderMessages = (
    <Stack spacing={2}>
      {(ticket.messages || []).map((message) => (
        <Card
          key={message.id}
          sx={{
            p: 2,
            boxShadow: "none",
            bgcolor: message.is_staff ? "background.neutral" : "transparent",
            border: (t) => `1px solid ${t.palette.divider}`,
          }}
        >
          <Stack direction="row" spacing={2}>
            <ProfileAvatar
              user={message.author_user}
              size={40}
              avatarSx={{
                ...(message.is_staff && {
                  border: (theme) => `2px solid ${theme.palette.primary.main}`,
                }),
              }}
            />
            <Stack spacing={0.75} sx={{ flexGrow: 1, minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
              >
                <Typography
                  variant="subtitle2"
                  color={message.is_staff ? "primary.main" : "text.primary"}
                >
                  {message.author}
                </Typography>
                {message.is_staff && (
                  <Chip size="small" label="Support" color="primary" />
                )}
                <Typography variant="caption" color="text.disabled">
                  {fDateTime(message.created_date)}
                </Typography>
              </Stack>

              <Box
                className="ticket-body"
                sx={TICKET_BODY_SX}
                dangerouslySetInnerHTML={{ __html: message.body || "" }}
              />

              {!!message.files?.length && (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {message.files.map((file) => (
                    <Link
                      key={file.id}
                      href={fileUrl(file.attach)}
                      target="_blank"
                      rel="noopener"
                      variant="caption"
                    >
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Iconify icon="eva:attach-2-fill" width={14} />
                        {String(file.attach || "")
                          .split("/")
                          .pop()}
                      </Stack>
                    </Link>
                  ))}
                </Stack>
              )}
            </Stack>
          </Stack>
        </Card>
      ))}
    </Stack>
  );

  const renderReply = (
    <Card
      sx={{
        p: 2,
        boxShadow: "none",
        border: (t) => `1px solid ${t.palette.divider}`,
      }}
    >
      {isClosed ? (
        <Alert severity="info">
          Энэ хүсэлт хаагдсан тул нэмэлт мэдээлэл бичих боломжгүй. Шинэ асуудал
          гарвал шинэ хүсэлт үүсгэнэ үү.
        </Alert>
      ) : (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Нэмэлт мэдээлэл бичих</Typography>
          <TicketEditor
            id="ticket-reply"
            value={body}
            onChange={setBody}
            placeholder="Хариу эсвэл нэмэлт тайлбараа бичнэ үү. Хүснэгт, зураг оруулж болно."
          />
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            justifyContent="space-between"
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
            >
              <Button
                component="label"
                size="small"
                variant="outlined"
                startIcon={<Iconify icon="eva:attach-2-fill" />}
              >
                Файл
                <input
                  hidden
                  type="file"
                  multiple
                  onChange={(event) => {
                    setFiles((prev) => [
                      ...prev,
                      ...Array.from(event.target.files || []),
                    ]);
                    event.target.value = "";
                  }}
                />
              </Button>
              {files.map((file, index) => (
                <Chip
                  key={`${file.name}-${index}`}
                  size="small"
                  label={file.name}
                  onDelete={() =>
                    setFiles((prev) => prev.filter((_, i) => i !== index))
                  }
                />
              ))}
            </Stack>
            <LoadingButton
              variant="contained"
              size="small"
              loading={sending}
              onClick={handleReply}
              startIcon={<Iconify icon="eva:paper-plane-fill" />}
            >
              Илгээх
            </LoadingButton>
          </Stack>
        </Stack>
      )}
    </Card>
  );

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h6">{ticket.subject}</Typography>
        <Typography variant="caption" color="text.secondary">
          Хүсэлт #{ticket.number}
        </Typography>
      </Stack>

      <Divider />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 280px" },
          gap: 2,
          alignItems: "start",
        }}
      >
        <Stack spacing={2}>
          {renderMessages}
          {renderReply}
        </Stack>
        <Stack spacing={2}>
          {renderDetails}
          {renderRating}
        </Stack>
      </Box>
    </Stack>
  );
}
