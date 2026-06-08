import PropTypes from "prop-types";
import { Tabs, Tab } from "@mui/material";
import Label from "src/components/label";
import { useCallback } from "react";
import { Box } from "@mui/system";

export default function UserTableStatusBar({ filters, onFilters, STATUSES }) {
  const handleStatusChange = useCallback(
    (_, newValue) => {
      onFilters("roles_in", newValue ?? null); // null болвол API руу явахдаа хаяж болно
    },
    [onFilters]
  );

  return (
    <Box sx={{ px: 2, pt: 1 }}>
      <Tabs value={filters.roles_in ?? ""} onChange={handleStatusChange}>
        {STATUSES.map((tab) => (
          <Tab
            key={tab.id || "all"}
            value={tab.id ?? ""}
            label={tab.name}
            iconPosition="end"
            icon={
              <Label
                variant={
                  filters.roles_in === tab.id ||
                  (tab.id === "" && !filters.roles_in)
                    ? "filled"
                    : "soft"
                }
                color={tab?.color || "default"}
              >
                {String(tab.count)}
              </Label>
            }
            sx={{ "&:not(:last-of-type)": { mr: 3 } }}
          />
        ))}
      </Tabs>
    </Box>
  );
}

UserTableStatusBar.propTypes = {
  STATUSES: PropTypes.array.isRequired,
  filters: PropTypes.object,
  onFilters: PropTypes.func,
};
