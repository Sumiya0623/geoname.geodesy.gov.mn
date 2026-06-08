import { Box, Button, Divider } from '@mui/material'
import React from 'react'
import { RouterLink } from 'src/routes/components'
import Iconify from '../iconify'

function ErrorControl() {
  return (
    <>
      <Divider sx={{ width: '100%', maxWidth: 360, mb: 3 }} />

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Button
          component={RouterLink}
          href="/"
          size="large"
          variant="contained"
          startIcon={<Iconify icon="eva:home-fill" />}
        >
          Нүүр хуудас
        </Button>
        <Button
          component={RouterLink}
          href={process.env.NEXT_PUBLIC_PORTAL_URL || '/'}
          size="large"
          variant="outlined"
          startIcon={<Iconify icon="mingcute:world-line" />}
        >
          Портал руу шилжих
        </Button>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Button
          onClick={() => window.history.back()}
          size="large"
          variant="outlined"
          startIcon={<Iconify icon="eva:arrow-back-fill" />}
        >
          Буцах
        </Button>
      </Box>
    </>
  )
}

export default ErrorControl