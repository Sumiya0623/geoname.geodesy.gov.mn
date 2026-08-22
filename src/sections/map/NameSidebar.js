import { useRef, useState, useEffect } from "react";
import { Box, Button, Popover, Typography, IconButton } from "@mui/material";
import {
  Close as CloseIcon,
  ArrowBackRounded as ArrowBackIcon,
} from "@mui/icons-material";

import NameDetailCard from "./NameDetailCard";

const NameSidebar = ({
  open,
  onClose,
  selectedName,
  onNameSelect,
  anchorPosition,
  onAnchorPositionChange,
}) => {
  const dragStateRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    startTop: 0,
    startLeft: 0,
  });
  // Дэлгэрэнгүй доторх өөрчлөх хүсэлтийн форм нээлттэй эсэх (толгойн Буцах товчинд)
  const [formOpen, setFormOpen] = useState(false);
  const goBack = () => window.dispatchEvent(new Event("geoname:formBack"));

  const popoverContainer =
    typeof window !== "undefined"
      ? document.getElementById("map-viewport") || undefined
      : undefined;

  const handleHeaderMouseDown = (event) => {
    event.preventDefault();
    if (!anchorPosition) return;
    dragStateRef.current = {
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      startTop: anchorPosition.top,
      startLeft: anchorPosition.left,
    };
  };

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!dragStateRef.current.dragging) return;
      const dx = event.clientX - dragStateRef.current.startX;
      const dy = event.clientY - dragStateRef.current.startY;
      const nextTop = dragStateRef.current.startTop + dy;
      const nextLeft = dragStateRef.current.startLeft + dx;
      if (onAnchorPositionChange) {
        onAnchorPositionChange({
          top: nextTop,
          left: nextLeft,
        });
      }
    };

    const handleMouseUp = () => {
      if (dragStateRef.current.dragging) {
        dragStateRef.current.dragging = false;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onAnchorPositionChange]);

  return (
    <>
      <Popover
        open={open}
        onClose={onClose}
        disableScrollLock
        container={popoverContainer}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition}
        anchorOrigin={{
          vertical: "center",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "center",
          horizontal: "left",
        }}
        // Popover‑ийн container pointer‑event авахгүй → газрын зураг ард нь идэвхтэй
        // (scroll‑zoom ажиллана). Зөвхөн paper дээр л үйлдэл хийнэ.
        sx={{ pointerEvents: "none" }}
        PaperProps={{
          sx: {
            pointerEvents: "auto",
            // Агуулгадаа тохирно — энгийн үед 360, өргөн форм нээгдвэл өргөснө.
            // Өндрийг ДЭЛГЭЦЭЭР хязгаарлана → MUI харагдах хүрээнд байрлуулж,
            // доод хэсэг (Бүртгэх) таслагдахгүй. Scroll зөвхөн дэлгэцээс өндөр
            // (маш урт форм) үед л гарна — үргэлж биш.
            // Тогтмол анхдагч өргөн — агуулгын урт (төслийн нэр) тэлэхгүй.
            // Хэрэглэгч булангаас чирж өөрчилнө (resize).
            width: { xs: "94vw", sm: 680 },
            minWidth: { xs: 320, sm: 360 },
            maxWidth: "calc(100vw - 24px)",
            maxHeight: "calc(100vh - 16px)",
            // Хэрэглэгч баруун доод булангаас чирж ЦОНХНЫ хэмжээг өөрчилнө
            resize: "both",
            overflow: "auto",
            backgroundColor: "#f8f9fa",
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            borderRadius: 2,
            border: "1px solid rgba(0,0,0,0.08)",
            ml: 1, // Add some margin from the anchor point
            padding: 0,
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            bgcolor: "primary.main",
            color: "white",
            py: 0.5,
            px: 2,
            cursor: "grab",
          }}
          onMouseDown={handleHeaderMouseDown}
        >
          {formOpen ? (
            <Button
              startIcon={<ArrowBackIcon fontSize="small" />}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={goBack}
              sx={{
                color: "white",
                textTransform: "none",
                fontWeight: 600,
                "&:hover": { bgcolor: "rgba(255,255,255,0.14)" },
              }}
            >
              Буцах
            </Button>
          ) : (
            <Typography variant="h6">Газар зүйн нэр</Typography>
          )}
          <IconButton
            onMouseDown={(e) => e.stopPropagation()}
            onClick={formOpen ? goBack : onClose}
          >
            <CloseIcon sx={{ color: "white" }} />
          </IconButton>
        </Box>

        {selectedName && (
          <NameDetailCard
            name={selectedName}
            onSelect={onNameSelect}
            onAfterAction={onClose}
            onFormOpenChange={setFormOpen}
          />
        )}
      </Popover>
    </>
  );
};

export default NameSidebar;
