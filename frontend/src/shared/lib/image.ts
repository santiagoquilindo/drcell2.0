const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const MAX_DIMENSION = 1600

export async function fileToDataUrl(file: File) {
  const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])

  if (!allowedTypes.has(file.type)) {
    throw new Error('Solo se permiten imagenes PNG, JPG o WEBP.')
  }

  if (file.size <= MAX_IMAGE_BYTES) {
    return readFileAsDataUrl(file)
  }

  const optimized = await optimizeImage(file)
  if (optimized.size > MAX_IMAGE_BYTES) {
    throw new Error('La imagen no pudo optimizarse por debajo de 3 MB. Usa una imagen mas liviana.')
  }

  return readFileAsDataUrl(optimized)
}

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })
}

async function optimizeImage(file: File) {
  const image = await loadImage(file)
  const { width, height } = scaleDimensions(image.naturalWidth, image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('No se pudo procesar la imagen en este navegador.')
  }

  context.drawImage(image, 0, 0, width, height)

  const qualities = [0.88, 0.8, 0.72, 0.64, 0.56, 0.48, 0.4]
  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, 'image/webp', quality)
    if (blob.size <= MAX_IMAGE_BYTES) {
      return blob
    }
  }

  return canvasToBlob(canvas, 'image/jpeg', 0.72)
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('No se pudo procesar la imagen seleccionada.'))
    }
    image.src = objectUrl
  })
}

function scaleDimensions(width: number, height: number) {
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
    return { width, height }
  }

  const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo exportar la imagen optimizada.'))
          return
        }
        resolve(blob)
      },
      type,
      quality,
    )
  })
}
