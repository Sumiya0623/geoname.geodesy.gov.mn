"use client";

import PropTypes from "prop-types";
import { useState } from "react";

import Box from "@mui/material/Box";

import CollapseCard from "src/components/collapse-card";

import { TeamListView } from "src/sections/champaign/team/view";
import { WorkMapListView } from "src/sections/champaign/workmap/view";

// ----------------------------------------------------------------------
// ХЭЭРИЙН СУДАЛГАА — төслийн дэлгэрэнгүйн таб (хуудас).
// Дотроо 2 задардаг хэсэгт 2 бие даасан жагсаалтыг дуудна:
//   • Ажлын зураг        — sections/workmap
//   • Багийн бүрэлдэхүүн — sections/team
// Жагсаалтууд нь өөрсдөө бүрэн (toolbar/хүснэгт/хуудаслалт/эрх) тул өөр
// хуудаснаас ч дангаар нь дуудаж болно.
// ----------------------------------------------------------------------

export default function HeerView({ projectId }) {
  const [mapCount, setMapCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);

  if (!projectId) return null;

  return (
    <Box>
      <CollapseCard icon="solar:map-bold" title="Ажлын зураг" count={mapCount}>
        <WorkMapListView projectId={projectId} onCount={setMapCount} />
      </CollapseCard>

      <CollapseCard
        icon="solar:users-group-rounded-bold"
        title="Багийн бүрэлдэхүүн"
        count={teamCount}
      >
        <TeamListView
          projectId={projectId}
          stepName="Хээрийн судалгаа"
          onCount={setTeamCount}
        />
      </CollapseCard>
    </Box>
  );
}

HeerView.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
