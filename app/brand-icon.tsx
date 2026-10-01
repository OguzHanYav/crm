import { ImageResponse } from 'next/og'
import { LOGO_MARK_PATH, LOGO_MARK_VIEWBOX } from '@/components/brand/logo-mark'

// Gemeinsame Vorlage für app/icon.tsx (Browser-Tab) und app/apple-icon.tsx
// (Lesezeichen / Homescreen): blaues Quadrat mit der weißen OY-Bildmarke.
// Bildmarke nimmt 75 % der Fläche ein (32 px Icon -> 24 px Symbol), Ecken-Radius 25 % (32 px -> 8 px).
export function renderBrandIcon(size: number, rounded: boolean) {
  const inset = Math.round(size * 0.125)
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2563eb',
          borderRadius: rounded ? Math.round(size * 0.25) : 0,
        }}
      >
        <svg width={size - inset * 2} height={size - inset * 2} viewBox={LOGO_MARK_VIEWBOX}>
          <path d={LOGO_MARK_PATH} fill="#ffffff" fillRule="evenodd" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  )
}
