"use client";

import PropTypes from "prop-types";
import { useState } from "react";

import Box from "@mui/material/Box";

import CollapseCard from "src/components/collapse-card";

import { TeamListView } from "src/sections/team/view";
import { RecountListView } from "src/sections/recount/view";

// ----------------------------------------------------------------------
// СУУРИН СУДАЛГАА — төслийн дэлгэрэнгүйн таб (хуудас).
// Дотроо 2 задардаг хэсэгт 2 бие даасан жагсаалтыг дуудна:
//   • Дахин тооллого (тодруулалт) — sections/recount
//   • Багийн бүрэлдэхүүн          — sections/team
// ----------------------------------------------------------------------

export default function SuurinView({ projectId }) {
  const [recountCount, setRecountCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);

  if (!projectId) return null;

  return (
    <Box>
      <CollapseCard
        icon="solar:clipboard-list-bold"
        title="Суурин тодруулалт"
        count={recountCount}
      >
        <RecountListView projectId={projectId} onCount={setRecountCount} />
      </CollapseCard>

      <CollapseCard
        icon="solar:users-group-rounded-bold"
        title="Багийн бүрэлдэхүүн"
        count={teamCount}
      >
        <TeamListView
          projectId={projectId}
          stepName="Суурин судалгаа"
          onCount={setTeamCount}
        />
      </CollapseCard>
    </Box>
  );
}

SuurinView.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
