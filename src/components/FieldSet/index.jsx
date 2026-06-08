import React from 'react'

import { Box, Typography } from "@mui/material";

const Fieldset = ({
  title,
  color = "inherit",
  titleSize = "1rem",
  borderWidth = 1,
  borderRadius = 2,
  children,
  sx = {},
  ...props
}) => {
  return (
    <Box
      component="fieldset"
      sx={{
        borderColor: color,
        borderWidth: borderWidth,
        borderRadius: borderRadius,
        ...sx,
      }}
      {...props}
    >
      {title && (
        <Typography
          component="legend"
          sx={{
            color: color,
            fontSize: titleSize,
            fontWeight: 'bold',
          }}
        >
          {title}
        </Typography>
      )}
      {children}
    </Box>
  );
};

export default Fieldset
