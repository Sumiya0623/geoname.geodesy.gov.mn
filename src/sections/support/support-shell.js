"use client";

import PropTypes from "prop-types";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";

import SupportHeader from "./support-header";

// ----------------------------------------------------------------------
// Тусламжийн хуудсын бүрхүүл — төв системийн хуудастай ижил: картан дотроо
// табуудтай, дээр нь нүүр хуудас руу буцах товч.
// ----------------------------------------------------------------------

export default function SupportShell({ children }) {
  return (
    <>
      <SupportHeader />

      <Container
        maxWidth="xl"
        sx={{ py: { xs: 2, md: 3 }, px: { xs: 1.5, sm: 3 } }}
      >
        <Box
          sx={{
            bgcolor: "background.paper",
            borderRadius: 3,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            px: { xs: 1.5, sm: 2, md: 4 },
            pb: { xs: 2.5, md: 4 },
            minHeight: { xs: "auto", md: "calc(100vh - 260px)" },
          }}
        >
          {children}
        </Box>
      </Container>
    </>
  );
}

SupportShell.propTypes = {
  children: PropTypes.node,
};
