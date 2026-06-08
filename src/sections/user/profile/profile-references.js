"use client";

import { useState, useMemo } from "react";

import {
  Box,
  Card,
  Table,
  Button,
  TableRow,
  TableBody,
  TableCell,
  TableContainer,
} from "@mui/material";
import { Icon } from "@iconify/react";

import { fDate } from "src/utils/format-time";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetRequests } from "src/api/request";
import { useAuthContext } from "src/auth/hooks";

import Label from "src/components/label";
import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import {
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
} from "src/components/table";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 48 },
  { id: "", label: "Газар зүйн нэр" },
  { id: "", label: "Төрөл", width: 160 },
  { id: "", label: "Төлөв", width: 140 },
  { id: "", label: "Огноо", width: 130 },
  { id: "", label: "Лавлагаа", width: 160, align: "center" },
];

// ----------------------------------------------------------------------

export default function ProfileReferences() {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const [downloadingId, setDownloadingId] = useState(null);

  const { requests, requestsLoading } = useGetRequests(
    user?.id
      ? { user: user.id, page_size: 200, ordering: "-created_date" }
      : null,
  );

  // Лавлагаа/гэрчилгээ зөвхөн батлагдсан газар зүйн нэртэй хүсэлтэд
  const rows = useMemo(
    () => requests.filter((req) => req.name?.name),
    [requests],
  );

  const handleDownload = async (id) => {
    try {
      setDownloadingId(id);
      const res = await axiosInstance.get(endpoints.request.form(id), {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `лавлагаа_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      enqueueSnackbar("Лавлагаа татахад алдаа гарлаа", { variant: "error" });
    } finally {
      setDownloadingId(null);
    }
  };

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
                  <TableRow key={row.id} hover>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell sx={{ whiteSpace: "normal" }}>
                      {row.name?.name || "-"}
                    </TableCell>
                    <TableCell>{row.type?.name || "-"}</TableCell>
                    <TableCell>
                      {row.status ? (
                        <Label variant="soft" color={row.status.color || "default"}>
                          {row.status.name}
                        </Label>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {row.created_date ? fDate(row.created_date) : "-"}
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="soft"
                        color="primary"
                        onClick={() => handleDownload(row.id)}
                        disabled={downloadingId === row.id}
                        startIcon={
                          <Icon
                            icon={
                              downloadingId === row.id
                                ? "eos-icons:loading"
                                : "solar:file-download-bold"
                            }
                          />
                        }
                        sx={{ whiteSpace: "nowrap" }}
                      >
                        Татах
                      </Button>
                    </TableCell>
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
          Нийт {rows.length} лавлагаа
        </Box>
      )}
    </Card>
  );
}
