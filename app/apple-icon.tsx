import { renderBrandIcon } from './brand-icon'

// iOS rundet die Ecken selbst ab -> volle Fläche ohne eigene Rundung.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return renderBrandIcon(size.width, false)
}
