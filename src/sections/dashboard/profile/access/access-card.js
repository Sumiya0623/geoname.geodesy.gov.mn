import React from 'react'
import PropTypes from 'prop-types'
import { Card, Typography, Avatar, Stack } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

function AccessCard({ icon, title, subtitle, value, color = 'primary', gradient, sx }) {
  const theme = useTheme();
  const paletteColor = theme.palette[color] || theme.palette.primary;
  const gradientBg = gradient
    ? `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`
    : `linear-gradient(135deg, ${alpha(paletteColor.main, 0.9)}, ${alpha(paletteColor.light || paletteColor.main, 0.9)})`;

  return (
    <Card
      sx={{
        position: 'relative',
        px: 3,
        py: 2.5,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        boxShadow: (t) => `0 4px 12px ${alpha(t.palette.common.black, 0.04)}`,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        '::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            borderTopLeftRadius: 8,
            borderBottomLeftRadius: 8,
            background: gradientBg
        },
        ...sx,
      }}
    >
        <Stack spacing={0.5} sx={{ pr: 2, flex: 1, minWidth: 0 }}>
            {title && (
            <Typography variant="subtitle2" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {title}
            </Typography>
            )}
            {subtitle && (
            <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {subtitle}
            </Typography>
            )}
            {value !== undefined && (
            <Typography variant="h5" sx={{ mt: 0.5 }}>
                {value}
            </Typography>
            )}
        </Stack>

        <Avatar
            variant="circular"
            sx={{
                width: 56,
                height: 56,
                background: gradientBg,
                color: '#fff',
                boxShadow: (t) => `0 4px 10px ${alpha('#000', 0.18)}`,
                fontSize: 28,
            }}
        >
            {icon}
        </Avatar>
    </Card>
  )
}

AccessCard.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  color: PropTypes.string,
  gradient: PropTypes.array,
  sx: PropTypes.object,
}

export default AccessCard