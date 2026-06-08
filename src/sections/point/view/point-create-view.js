"use client";

import Container from "@mui/material/Container";
import Button from "@mui/material/Button";
import { alpha } from "@mui/material/styles";

import { paths } from "src/routes/paths";

import { useSettingsContext } from "src/components/settings";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import Iconify from "src/components/iconify";

import PointNewEditForm from "../point-new-edit-form";
import PointDocumentDialog from "../PointDocumentDialog";
import { useState } from "react";

// ----------------------------------------------------------------------

export default function PointCreateView() {
  const settings = useSettingsContext();

  const [openDialog, setOpenDialog] = useState(false);
  
  const handleOpenDialog = () => setOpenDialog(true);
  const handleCloseDialog = () => setOpenDialog(false);
  
  const handleSubmitDocuments = (data) => {
    console.log('Document data submitted:', data);
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <CustomBreadcrumbs
        heading="Цэг тэмдэгт бүртгэх"
        links={[
          {
            name: "Цэг тэмдэгт",
            href: paths.dashboard.point.root,
          },
          { name: "Шинэ" },
        ]}
        sx={{
          mb: { xs: 3, md: 5 },
        }}
      />

      <Button
        variant="contained"
        color="secondary"
        startIcon={<Iconify icon="mdi:file-document-multiple" />}
        onClick={handleOpenDialog}
        sx={{
          position: 'fixed',
          bottom: 40,
          right: 40,
          zIndex: 1000,
          borderRadius: '50%',
          width: 64,
          height: 64,
          padding: 0,
          minWidth: 'auto',
          boxShadow: (theme) => `0 8px 16px 0 ${alpha(theme.palette.primary.main, 0.24)}`,
          '&:hover': {
            transform: 'translateY(-4px)',
            transition: 'transform 0.3s ease',
          },
        }}
      >
        <Iconify icon="mdi:file-document-multiple" width={28} height={28} />
      </Button>

      {/* Using our new independent dialog component */}
      <PointDocumentDialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        onSubmit={handleSubmitDocuments}
      />
      
      <PointNewEditForm />
    </Container>
  );
}
