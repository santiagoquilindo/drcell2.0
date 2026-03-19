import { env } from '@shared/config/env'

export function resolveAssetUrl(assetPath?: string | null) {
  if (!assetPath) return null
  if (/^https?:\/\//i.test(assetPath)) return assetPath

  const baseUrl = env.apiUrl.replace(/\/api\/?$/, '')
  return `${baseUrl}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`
}
