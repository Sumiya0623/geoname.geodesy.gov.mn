'use client'

import React from 'react'
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material'

const CustomCard = ({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}) => {
  return (
    <Card 
      sx={{ 
        width: { xs: '90vw', sm: 400, md: 448 }, 
        maxWidth: 448,
        margin: { xs: '0 auto', sm: 0 }
      }} 
      elevation={4}
    >
      <CardContent sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" justifyContent='space-between' mb={3}>
          <Box display="flex" gap={2} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
            {step?.icon && (
              <Box component="span" fontSize={18}>
                {step.icon}
              </Box>
            )}
            <Typography variant="h6" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {step?.title || ''}
            </Typography>
          </Box>
          {step.showSkip && currentStep < totalSteps - 1 && (
            <Button 
              variant="text" 
              sx={{ p: 0.5, ml: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }} 
              onClick={skipTour} 
              color="inherit"
            >
              Дуусгах
            </Button>
          )}
        </Box>
        <Box mb={3}>{step?.content || ''}</Box>
        {arrow}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2">
            {currentStep + 1} / {totalSteps}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {currentStep > 0 && (
              <Button variant="outlined" onClick={prevStep} size="small">
                Өмнөх
              </Button>
            )}
            <Button variant="contained" onClick={nextStep} size="small">
              {currentStep === totalSteps - 1 ? 'Дуусгах' : 'Дараагийх'}
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  )
}

export default CustomCard