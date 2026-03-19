const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatDateTime(value: string) {
  return dateFormatter.format(new Date(value))
}

export function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ')
}
