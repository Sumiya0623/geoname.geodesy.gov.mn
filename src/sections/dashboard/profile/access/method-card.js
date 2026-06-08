import PropTypes from 'prop-types';
import { Card, CardContent, Typography, Box, useTheme, ButtonBase } from '@mui/material';
import Iconify from 'src/components/iconify';
import { getMethodConfig } from './method-colors';

const MethodCard = ({ method, value, onClick, isSelected = false }) => {
  const theme = useTheme();
  const config = getMethodConfig(method);
  if (!config) return null;
  return (
    <ButtonBase
      onClick={() => onClick?.(method)}
      sx={{
        width: '100%',
        borderRadius: 2,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-2px) scale(1.01)',
        },
        '&:active': {
          transform: 'translateY(-1px) scale(0.99)',
        },
      }}
    >
      <Card
        sx={{
          width: '100%',
          minHeight: 80,
          borderRadius: 2,
          position: 'relative',
          overflow: 'hidden',
          backdropFilter: 'blur(10px)',
          border: isSelected 
            ? `2px solid ${config.color}` 
            : '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: isSelected
            ? `0 6px 24px ${config.color}30`
            : '0 3px 12px rgba(0, 0, 0, 0.1)',
          background: isSelected
            ? `linear-gradient(135deg, ${config.color}20, ${config.color}10, ${config.color}05)`
            : `linear-gradient(135deg, ${config.color}15, ${config.color}08, ${config.color}03)`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: `0 8px 24px ${config.color}40`,
            border: `1px solid ${config.color}60`,
          },
        }}
      >
        <CardContent sx={{ p: 2, position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 800, 
                  mb: 0.25,
                  fontSize: { xs: '1.2rem', sm: '1.4rem' },
                  textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                {value || 0}
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  opacity: 0.9, 
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  mb: 0.25,
                }}
              >
                {config.label}
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  opacity: 0.8, 
                  fontWeight: 400,
                  fontSize: '0.65rem',
                  lineHeight: 1.2,
                }}
              >
                {config.description}
              </Typography>
            </Box>
            <Box
              sx={{
                p: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <Iconify 
                icon={config.icon} 
                width={20} 
                height={20}
                sx={{ 
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                  opacity: 0.9,
                }}
              />
            </Box>
          </Box>
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 2,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.3) 100%)',
            }}
          />
        </CardContent>
      </Card>
    </ButtonBase>
  );
};

MethodCard.propTypes = {
  method: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onClick: PropTypes.func,
  isSelected: PropTypes.bool,
};

export default MethodCard;
