"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Badge from "@mui/material/Badge";
import Typography from "@mui/material/Typography";
import Pagination from "@mui/material/Pagination";
import CircularProgress from "@mui/material/CircularProgress";

import { fDateTime } from "src/utils/format-time";
import { TICKET_STATUS, TICKET_PRIORITY } from "src/api/main-support";

// ----------------------------------------------------------------------

export default function TicketList({
  tickets = [],
  loading,
  selectedId,
  onSelect,
  page = 1,
  totalPages = 1,
  onPageChange,
}) {
  if (loading && !tickets.length) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!tickets.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Танд одоогоор бүртгэгдсэн тусламжийн хүсэлт байхгүй байна.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {tickets.map((ticket) => {
        const status = TICKET_STATUS[ticket.status] || {};
        const priority = TICKET_PRIORITY[ticket.priority] || {};
        const isActive = selectedId === ticket.id;

        return (
          <Card
            key={ticket.id}
            onClick={() => onSelect?.(ticket)}
            sx={{
              p: 1.5,
              cursor: "pointer",
              border: (theme) =>
                `1px solid ${
                  isActive ? theme.palette.primary.main : theme.palette.divider
                }`,
              boxShadow: "none",
              "&:hover": { bgcolor: "background.neutral" },
            }}
          >
            <Stack spacing={0.75}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
              >
                <Typography variant="caption" color="text.secondary">
                  #{ticket.number}
                </Typography>
                <Chip
                  size="small"
                  label={ticket.status_label || status.label}
                  color={status.color || "default"}
                />
              </Stack>

              <Badge
                color="error"
                badgeContent={ticket.unread_count || 0}
                sx={{ "& .MuiBadge-badge": { right: -6, top: 6 } }}
              >
                <Typography
                  variant="subtitle2"
                  color={isActive ? "primary" : "text.primary"}
                  sx={{ pr: 1 }}
                >
                  {ticket.subject}
                </Typography>
              </Badge>

              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  variant="outlined"
                  label={ticket.priority_label || priority.label}
                  color={priority.color || "default"}
                />
                {ticket.system?.title && (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {ticket.system.title}
                  </Typography>
                )}
              </Stack>

              <Typography variant="caption" color="text.disabled">
                {fDateTime(ticket.created_date)}
              </Typography>
            </Stack>
          </Card>
        );
      })}

      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
          <Pagination
            size="small"
            color="primary"
            page={page}
            count={totalPages}
            onChange={(_, value) => onPageChange?.(value)}
          />
        </Box>
      )}
    </Stack>
  );
}
