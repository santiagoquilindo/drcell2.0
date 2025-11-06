import React from 'react'
import { X } from 'lucide-react'

export const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ open, onClose, title, children }) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-gray-900 border border-green-400 rounded-2xl w-full max-w-3xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-green-400/40">
          <h3 className="text-lg font-bold text-green-400">{title}</h3>
          <button onClick={onClose} className="text-green-300 hover:text-green-200" aria-label="Cerrar">
            <X />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
