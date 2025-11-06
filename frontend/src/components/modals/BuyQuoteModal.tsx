import React from 'react'
import { Modal } from '@components/Modal'
import { abrirWhatsApp, msgCompraDetalle, CompraTipo, SOPreferido } from '@utils/whatsapp'

type Props = { open: boolean; onClose: () => void }

export const BuyQuoteModal: React.FC<Props> = ({ open, onClose }) => {
  const [tipo, setTipo] = React.useState<CompraTipo>('Celular nuevo')
  const [so, setSO] = React.useState<SOPreferido>('Indiferente')
  const [marcaModelo, setMarcaModelo] = React.useState('')
  const [presupuesto, setPresupuesto] = React.useState<number | ''>('')
  const [obs, setObs] = React.useState('')

  const enviar = () => {
    abrirWhatsApp(
      msgCompraDetalle(
        tipo,
        marcaModelo,
        so,
        typeof presupuesto === 'number' ? presupuesto : undefined,
        obs
      )
    )
    onClose(); setMarcaModelo(''); setPresupuesto(''); setObs('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Cotizar compra">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block mb-1 text-gray-700">Tipo</span>
          <select className="w-full rounded border p-2" value={tipo} onChange={e => setTipo(e.target.value as CompraTipo)}>
            <option>Celular nuevo</option><option>Celular usado</option><option>Accesorio</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-gray-700">Preferencia SO</span>
          <select className="w-full rounded border p-2" value={so} onChange={e => setSO(e.target.value as SOPreferido)}>
            <option>Indiferente</option><option>Android</option><option>iPhone</option>
          </select>
        </label>

        <label className="col-span-2 text-sm">
          <span className="block mb-1 text-gray-700">Marca / Modelo (opcional)</span>
          <input className="w-full rounded border p-2" placeholder="Samsung A54, iPhone 12, Cargador USB-C..." value={marcaModelo} onChange={e => setMarcaModelo(e.target.value)} />
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-gray-700">Presupuesto (opcional)</span>
          <input type="number" min={0} className="w-full rounded border p-2" placeholder="Ej: 1200000" value={presupuesto} onChange={e => setPresupuesto(e.target.value === '' ? '' : Number(e.target.value))} />
        </label>

        <div />

        <label className="col-span-2 text-sm">
          <span className="block mb-1 text-gray-700">Observaciones (opcional)</span>
          <textarea className="w-full rounded border p-2" rows={3} placeholder="Color, capacidad, accesorios incluidos, etc." value={obs} onChange={e => setObs(e.target.value)} />
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border px-4 py-2">Cancelar</button>
        <button onClick={enviar} className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700">Enviar a WhatsApp</button>
      </div>
    </Modal>
  )
}
