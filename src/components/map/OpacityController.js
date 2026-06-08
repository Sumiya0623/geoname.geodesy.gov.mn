import React from 'react';
import { Box, Typography, Slider } from '@mui/material';

const OpacityController = ({ 
  value = 0.8, 
  onChange, 
  color = '#2196f3', 
  label = 'Opacity',
  sx = {},
  showLabel = true,
  showValue = true,
}) => {
  return (
    <Box sx={{ 
      px: 2, 
      py: 1,
      ...sx
    }}>
      {showLabel && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary' }}>
            {label}
          </Typography>
          {showValue && (
            <Typography variant="caption" sx={{ fontWeight: 600, color }}>
              {Math.round(value * 100)}%
            </Typography>
          )}
        </Box>
      )}
      
      <Slider
        value={value}
        onChange={(e, newValue) => onChange && onChange(newValue)}
        min={0.1}
        max={1}
        step={0.1}
        sx={{
          height: 4,
          '& .MuiSlider-track': {
            background: `linear-gradient(to right, ${color}33, ${color})`,
            border: 'none',
          },
          '& .MuiSlider-rail': {
            background: `${color}20`,
            opacity: 1,
          },
          '& .MuiSlider-thumb': {
            backgroundColor: color,
            width: 16,
            height: 16,
            boxShadow: `0 2px 8px ${color}40`,
            '&:hover': {
              boxShadow: `0 2px 12px ${color}60`,
            },
          },
        }}
      />
    </Box>
  );
};

export default OpacityController;
