import PropTypes from "prop-types";
import { Tabs, Tab, Divider } from "@mui/material";
import useSWR from "swr";

import Label from "src/components/label";
import axiosInstance, { endpoints, fetcher } from "src/utils/axios";
import { useGetNetWorksForDropDown } from "src/api/measurement";

// ----------------------------------------------------------------------

const COLORS = ["primary", "success", "info", "warning", "secondary", "error"];

function CountLabel({ extra, baseBody, active, color }) {
  const body = { ...baseBody, ...extra, page: 1, page_size: 1 };
  const qs = new URLSearchParams(body).toString();
  const url = endpoints.point.list(qs);
  const { data } = useSWR([url, axiosInstance, "get"], fetcher, {
    shouldRetryOnError: false,
  });
  return (
    <Label variant={active ? "filled" : "soft"} color={color}>
      {data?.count ?? 0}
    </Label>
  );
}

CountLabel.propTypes = {
  extra: PropTypes.object,
  baseBody: PropTypes.object,
  active: PropTypes.bool,
  color: PropTypes.string,
};

export default function PointTableStatusBar({ value, onChange, baseBody }) {
  const { networks = [] } = useGetNetWorksForDropDown({ parent: "" });

  return (
    <>
      <Tabs
        value={value || ""}
        onChange={(_, v) => onChange(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          px: 2.5,
          boxShadow: (theme) =>
            `inset 0 -2px 0 0 ${theme.palette.divider}`,
        }}
      >
        <Tab
          value=""
          label="Бүгд"
          iconPosition="end"
          icon={
            <CountLabel
              extra={{}}
              baseBody={baseBody}
              active={!value}
              color="default"
            />
          }
          sx={{ "&:not(:last-of-type)": { mr: 3 } }}
        />
        {networks.map((net, i) => {
          const tabValue = String(net.id);
          return (
            <Tab
              key={net.id}
              value={tabValue}
              label={net.name}
              iconPosition="end"
              icon={
                <CountLabel
                  extra={{ measurement_network_in: net.id }}
                  baseBody={baseBody}
                  active={value === tabValue}
                  color={COLORS[i % COLORS.length]}
                />
              }
              sx={{ "&:not(:last-of-type)": { mr: 3 } }}
            />
          );
        })}
      </Tabs>
      <Divider />
    </>
  );
}

PointTableStatusBar.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  baseBody: PropTypes.object,
};
