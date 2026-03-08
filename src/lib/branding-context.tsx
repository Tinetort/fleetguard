'use client'

import React, { createContext, useContext, ReactNode, useEffect } from 'react'
import type { OrgBranding } from './branding'

export const BrandingContext = createContext<OrgBranding | null>(null)

export function BrandingProvider({ 
  children, 
  branding 
}: { 
  children: ReactNode
  branding: OrgBranding 
}) {
  
  // Apply CSS variables to the root document if the organization provided custom colors
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      
      if (branding.primaryColor) {
        // e.g. Tailwind blue-600 is usually #2563eb
        root.style.setProperty('--brand-primary', branding.primaryColor)
      } else {
        root.style.removeProperty('--brand-primary')
      }

      if (branding.accentColor) {
        root.style.setProperty('--brand-accent', branding.accentColor)
      } else {
        root.style.removeProperty('--brand-accent')
      }
    }
  }, [branding.primaryColor, branding.accentColor])

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  const context = useContext(BrandingContext)
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider')
  }
  return context
}
