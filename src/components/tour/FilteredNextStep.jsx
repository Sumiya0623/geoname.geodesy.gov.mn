'use client'

import { useMemo } from 'react'
import { NextStep } from 'nextstepjs'
import { useContent } from 'src/hooks/use-content'
import { useMenuPermissions } from 'src/hooks/use-menu-permissions'
import guideDatas from 'src/utils/guide/guideDatas'
import CustomCard from 'src/utils/guide/CustomCard'

export default function FilteredNextStep({ children, ...props }) {
  const content = useContent()
  const menuperms = useMenuPermissions({ content })

  const steps = useMemo(() => {
    return guideDatas.map((tour) => {
      if (tour?.tour !== content) return tour
      const filteredSteps = (tour?.steps || []).filter((step) => {
        if (!step.perm) return true
        return !!menuperms?.[step.perm]
      })
      return { ...tour, steps: filteredSteps }
    })
  }, [content, menuperms])

  const handleStepChange = (step, tourName) => {
    if (tourName === 'geoserver' && step === 3) {
      window.dispatchEvent(new CustomEvent('geoserver:switch-to-groups'))
    }
    if (tourName === 'map' && step === 7) {
      window.dispatchEvent(new CustomEvent('map:open-geoserver-dialog'))
    }
    if (tourName === 'agreement-dynamic' && step === 5) {
      window.dispatchEvent(new CustomEvent('agreement:switch-to-act'))
    }
    if (tourName === 'service-dynamic' && step === 7) {
      window.dispatchEvent(new CustomEvent('point:switch-to-orderact'))
    }
  }

  return (
    <NextStep {...props} steps={steps} cardComponent={CustomCard} onStepChange={handleStepChange}>
      {children}
    </NextStep>
  )
}
