import React from 'react'

export const ImageWithFallback: React.FC<{
  src: string; alt: string; emoji?: string; className?: string
}> = ({ src, alt, emoji = '📱', className }) => {
  const [error, setError] = React.useState(false)
  return (
    <div className={className ?? 'h-48 w-full overflow-hidden rounded-lg bg-gradient-to-br from-gray-800 to-black flex items-center justify-center text-7xl'}>
      {!error ? (
        <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover" onError={() => setError(true)} />
      ) : (
        <span role="img" aria-label={alt}>{emoji}</span>
      )}
    </div>
  )
}
