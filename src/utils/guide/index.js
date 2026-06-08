import { IconButton, Popover, MenuItem, Typography } from '@mui/material'
import React, { useState, memo, useMemo } from 'react'
import { useNextStep } from 'nextstepjs'
import { useParams } from 'next/navigation'
import Iconify from 'src/components/iconify'
import { useContent } from 'src/hooks/use-content'
import { useMenuPermissions } from 'src/hooks/use-menu-permissions'
import guideDatas from './guideDatas'
import { enqueueSnackbar } from 'notistack'

const Guide = memo(function Guide() {
  const [anchorEl, setAnchorEl] = useState(null)
  const { startNextStep } = useNextStep()
  const content = useContent()
  const params = useParams()
  const permissions = useMenuPermissions({ content })

  const isDynamicPage = params && Object.keys(params).length > 0
  const tourName = isDynamicPage ? `${content}-dynamic` : content

  const activeTour = useMemo(() => {
    const dynamicTour = guideDatas.find((tour) => tour?.tour === `${content}-dynamic`)
    const staticTour = guideDatas.find((tour) => tour?.tour === content)
    
    if (isDynamicPage && dynamicTour) {
      return dynamicTour
    }
    return staticTour || null
  }, [content, isDynamicPage])

  const permittedSteps = useMemo(() => {
    if (!activeTour) return []
    return (activeTour.steps || [])
      .filter((step) => {
        if (!step.perm) return true
        return !!permissions?.[step.perm]
      })
      .map((step) => {
        if (step.selector && !document.querySelector(step.selector)) {
          const { selector, ...stepWithoutSelector } = step
          return stepWithoutSelector
        }
        return step
      })
  }, [activeTour, permissions])

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleGuideOption = () => {
    if (!activeTour) {
      enqueueSnackbar('Энэ хуудсанд зориулсан заавар байхгүй байна.', { variant: 'info' })
      handleClose()
      return
    }

    if (!permittedSteps.length) {
      enqueueSnackbar('Таны эрхээр үзэх боломжтой заавар алга байна.', { variant: 'info' })
      handleClose()
      return
    }

    try {
      startNextStep(tourName)
    } catch (error) {
      console.error('Error starting tour:', error)
    }
    handleClose()
  }

  const open = Boolean(anchorEl)

  return (
    <>
      <IconButton 
        onClick={handleClick}
        sx={{ 
          display: { xs: 'none', sm: 'inline-flex' } 
        }}
      >
        <Iconify icon="mingcute:question-fill" width="12" height="12" />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <MenuItem onClick={handleGuideOption}>
          <Iconify icon="material-symbols:help-outline" width="16" height="16" sx={{ mr: 1 }} />
          <Typography variant="body2">Хуудасны заавар</Typography>
        </MenuItem>
      </Popover>
    </>
  )
})

export default Guide