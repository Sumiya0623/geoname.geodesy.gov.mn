"use client";

import { useMemo } from "react";

import {
  Box,
  Card,
  Table,
  TableRow,
  TableBody,
  TableCell,
  TableContainer,
} from "@mui/material";

import { fDate } from "src/utils/format-time";
import { useGetRequests } from "src/api/request";
import { useAuthContext } from "src/auth/hooks";

import Label from "src/components/label";
import Scrollbar from "src/components/scrollbar";
import {
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
} from "src/components/table";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 48 },
  { id: "", label: "Санал болгосон нэр" },
  { id: "", label: "Батлагдсан нэр" },
  { id: "", label: "Төрөл", width: 160 },
  { id: "", label: "Төлөв", width: 140 },
  { id: "", label: "Огноо", width: 130 },
];

// ----------------------------------------------------------------------

export default function ProfileNames() {
  const { user } = useAuthContext();

  // Хэрэглэгчийн бүх хүсэлтийг татаж нэрсийг задална
  const { requests, requestsLoading } = useGetRequests(
    user?.id
      ? { user: user.id, page_size: 200, ordering: "-created_date" }
      : null,
  );

  // Хүсэлт бүрийн санал болгосон нэр (options) болон батлагдсан нэрийг (name)
  // нэг мөр болгон задлана.
  const rows = useMemo(() => {
    const list = [];
    requests.forEach((req) => {
      const opts = req.options || [];
      if (opts.length) {
        opts.forEach((o) => {
          list.push({
            proposed: [o.name, o.name2].filter(Boolean).join(" / ") || "-",
            approved: req.name?.name || "-",
            type: req.type?.name || "-",
            status: req.status,
            date: req.created_date,
          });
        });
      } else {
        list.push({
          proposed: req.name?.name || "-",
          approved: req.name?.name || "-",
          type: req.type?.name || "-",
          status: req.status,
          date: req.created_date,
        });
      }
    });
    return list;
  }, [requests]);

  const notFound = !requestsLoading && rows.length === 0;

  return (
    <Card>
      <TableContainer sx={{ position: "relative", overflow: "unset" }}>
        <Scrollbar>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHeadCustom headLabel={TABLE_HEAD} />
            <TableBody>
              {requestsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableSkeleton key={i} headLength={TABLE_HEAD.length} />
                ))
              ) : (
                rows.map((row, index) => (
                  <TableRow key={index} hover>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell sx={{ whiteSpace: "normal" }}>
                      {row.proposed}
                    </TableCell>
                    <TableCell>{row.approved}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>
                      {row.status ? (
                        <Label variant="soft" color={row.status.color || "default"}>
                          {row.status.name}
                        </Label>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{row.date ? fDate(row.date) : "-"}</TableCell>
                  </TableRow>
                ))
              )}
              <TableNoData notFound={notFound} />
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      {!requestsLoading && rows.length > 0 && (
        <Box sx={{ p: 2, color: "text.secondary", typography: "caption" }}>
          Нийт {rows.length} нэр
        </Box>
      )}
    </Card>
  );
}
