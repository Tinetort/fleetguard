import { createClient } from '../../utils/supabase/server'

export interface OrgBranding {
  id: string
  name: string
  displayName: string | null
  logoUrl: string | null
  primaryColor: string | null
  accentColor: string | null
}

const DEFAULT_BRANDING: OrgBranding = {
  id: '',
  name: 'Our Organization',
  displayName: null,
  logoUrl: null,
  primaryColor: null,
  accentColor: null,
}

export async function getOrgBranding(orgId: string | undefined | null): Promise<OrgBranding> {
  if (!orgId) return DEFAULT_BRANDING

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('organizations')
      .select('id, name, display_name, logo_url, primary_color, accent_color')
      .eq('id', orgId)
      .single()

    if (!data) return DEFAULT_BRANDING

    return {
      id: data.id,
      name: data.name,
      displayName: data.display_name,
      logoUrl: data.logo_url,
      primaryColor: data.primary_color,
      accentColor: data.accent_color,
    }
  } catch (err) {
    console.error('Error fetching org branding:', err)
    return DEFAULT_BRANDING
  }
}
