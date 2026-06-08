import { useEffect, useRef } from "react";
import {
  Box,
  Popover,
  Typography,
  IconButton,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

import NameDetailCard from "./NameDetailCard";

const NameSidebar = ({
  open,
  onClose,
  selectedName,
  onNameSelect,
  anchorPosition,
  ordersMutation,
  onAnchorPositionChange,
}) => {
  const dragStateRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    startTop: 0,
    startLeft: 0,
  });

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
        PaperProps={{
          sx: {
            width: { xs: 320, sm: 360 },
            maxHeight: "70vh",
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
          <Typography variant="h6">Газар зүйн нэр</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon sx={{ color: "white" }} />
          </IconButton>
        </Box>

        {selectedName && (
          <NameDetailCard
            name={selectedName}
            ordersMutation={ordersMutation}
            onSelect={onNameSelect}
            onAfterAction={onClose}
          />
        )}
      </Popover>
    </>
  );
};

export default NameSidebar;
