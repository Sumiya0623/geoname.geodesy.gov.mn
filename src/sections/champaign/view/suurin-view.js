"use client";

import PropTypes from "prop-types";
import { useState } from "react";

import Box from "@mui/material/Box";

import CollapseCard from "src/components/collapse-card";

import { TeamListView } from "src/sections/champaign/team/view";
import { RecountListView } from "src/sections/champaign/recount/view";
import { AttachListView } from "src/sections/champaign/attach/view";

// ----------------------------------------------------------------------
// СУУРИН СУДАЛГАА — төслийн дэлгэрэнгүйн таб (хуудас).
// Дотроо 3 задардаг хэсэгт 3 бие даасан жагсаалтыг дуудна:
//   • Дахин тооллого (тодруулалт)  — sections/recount
//   • Эрх зүйн баримт бичиг        — sections/attach (нэмэх + нэр холбох)
//   • Багийн бүрэлдэхүүн           — sections/team
// ----------------------------------------------------------------------

export default function SuurinView({ projectId }) {
  const [recountCount, setRecountCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
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

      {/* Төслийн эрх зүйн баримт бичгүүд — нэмэх / сангаас холбох / засах /
          хасах, мөрийг дарахад тодруулалтын нэр холбох хэсэг задарна.
          (Өмнө нь «Бэлтгэл ажил» табд давхардаж байсныг энд нэгтгэв.) */}
      <CollapseCard
        icon="solar:document-text-bold"
        title="Эрх зүйн баримт бичиг"
        count={orderCount}
        defaultOpen={false}
      >
        <AttachListView projectId={projectId} onCount={setOrderCount} />
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
