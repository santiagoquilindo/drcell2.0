import React from 'react'
import { Modal } from '@components/Modal'
import { abrirWhatsApp, msgReparacion, ReparacionEquipo, ReparacionDanio } from '@utils/whatsapp'

type Props = { open: boolean; onClose: () => void }

export const RepairQuoteModal: React.FC<Props> = ({ open, onClose }) => {
  const [equipo, setEquipo] = React.useState<ReparacionEquipo>('Celular')
  const [danio, setDanio] = React.useState<ReparacionDanio>('Hardware')
  const [marcaModelo, setMarcaModelo] = React.useState('')
  const [detalle, setDetalle] = React.useState('')

  const enviar = () => {
    abrirWhatsApp(msgReparacion(equipo, danio, marcaModelo, detalle))
    onClose(); setMarcaModelo(''); setDetalle('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Cotizar reparación">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block mb-1 text-gray-700">Equipo</span>
          <select className="w-full rounded border p-2" value={equipo} onChange={e => setEquipo(e.target.value as ReparacionEquipo)}>
            <option>Celular</option><option>Tablet</option><option>Laptop</option><option>Computador</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-gray-700">Tipo de daño</span>
          <select className="w-full rounded border p-2" value={danio} onChange={e => setDanio(e.target.value as ReparacionDanio)}>
            <option>Hardware</option><option>Software</option>
          </select>
        </label>

        <label className="col-span-2 text-sm">
          <span className="block mb-1 text-gray-700">Marca / Modelo (opcional)</span>
          <input className="w-full rounded border p-2" placeholder="Samsung A54, iPhone 12, Lenovo..." value={marcaModelo} onChange={e => setMarcaModelo(e.target.value)} />
        </label>

        <label className="col-span-2 text-sm">
          <span className="block mb-1 text-gray-700">Descripción (opcional)</span>
          <textarea className="w-full rounded border p-2" rows={3} placeholder="No enciende, pantalla rota, batería se descarga..." value={detalle} onChange={e => setDetalle(e.target.value)} />
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border px-4 py-2">Cancelar</button>
        <button onClick={enviar} className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700">Enviar a WhatsApp</button>
      </div>
    </Modal>
  )
}
