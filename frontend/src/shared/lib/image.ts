export async function fileToDataUrl(file: File) {
  const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])

  if (!allowedTypes.has(file.type)) {
    throw new Error('Solo se permiten imagenes PNG, JPG o WEBP.')
  }

  if (file.size > 3 * 1024 * 1024) {
    throw new Error('La imagen no puede superar 3 MB.')
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })
}
