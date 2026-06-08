import PropTypes from "prop-types";
import { useMemo } from "react";
import { Tabs, Tab, Divider } from "@mui/material";
import useSWR from "swr";

import Label from "src/components/label";
import axiosInstance, { endpoints, fetcher } from "src/utils/axios";
import { useGetConstantsFordropdown } from "src/api/constant";

// ----------------------------------------------------------------------

const TABS = [
  { value: "", label: "Бүгд", color: "default" },
  { value: "normal", label: "Хэвийн", color: "success" },
  { value: "deleted", label: "Устсан", color: "error" },
  { value: "pending", label: "Хяналт", color: "warning" },
  { value: "accepted", label: "Баталсан", color: "info" },
];

function useStatusCount(extra, baseBody) {
  const body = { ...baseBody, ...extra, page: 1, page_size: 1 };
  const qs = new URLSearchParams(body).toString();
  const url = endpoints.point.count.list(qs);
  const { data } = useSWR([url, axiosInstance, "get"], fetcher, {
    shouldRetryOnError: false,
  });
  return data?.count ?? 0;
}

export default function CountTableStatusBar({ value, onChange, baseBody }) {
  const { constants: statuses = [] } =
    useGetConstantsFordropdown("POINTSTATUS");

  const statusIdByName = useMemo(() => {
    const map = {};
    statuses.forEach((s) => {
      if (s?.name) map[s.name.trim().toLowerCase()] = s.id;
    });
    return map;
  }, [statuses]);

  const normalId = statusIdByName["хэвийн"];
  const deletedId = statusIdByName["устсан"];

  const allCount = useStatusCount({}, baseBody);
  const normalCount = useStatusCount(
    normalId ? { status_in: normalId } : {},
    baseBody,
  );
  const deletedCount = useStatusCount(
    deletedId ? { status_in: deletedId } : {},
    baseBody,
  );
  const pendingCount = useStatusCount({ accepted_state: "pending" }, baseBody);
  const acceptedCount = useStatusCount(
    { accepted_state: "accepted" },
    baseBody,
  );

  const counts = {
    "": allCount,
    normal: normalCount,
    deleted: deletedCount,
    pending: pendingCount,
    accepted: acceptedCount,
  };

  return (
    <>
      <Tabs
        value={value || ""}
        onChange={(_, v) => onChange(v)}
        sx={{ px: 2.5, boxShadow: (theme) => `inset 0 -2px 0 0 ${theme.palette.divider}` }}
      >
        {TABS.map((tab) => (
          <Tab
            key={tab.value || "all"}
            value={tab.value}
            label={tab.label}
            iconPosition="end"
            icon={
              <Label
                variant={value === tab.value ? "filled" : "soft"}
                color={tab.color}
              >
                {counts[tab.value] ?? 0}
              </Label>
            }
            sx={{ "&:not(:last-of-type)": { mr: 3 } }}
          />
        ))}
      </Tabs>
      <Divider />
    </>
  );
}

CountTableStatusBar.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  baseBody: PropTypes.object,
};
