import React from 'react'
import { Modal } from '@components/Modal'
import { abrirWhatsApp, msgCreditoDetalle, EntidadCredito } from '@utils/whatsapp'

type Props = { open: boolean; onClose: () => void }

export const CreditQuoteModal: React.FC<Props> = ({ open, onClose }) => {
  const [entidad, setEntidad] = React.useState<EntidadCredito>('Indiferente')
  const [monto, setMonto] = React.useState<number | ''>('')
  const [inicial, setInicial] = React.useState<number | ''>('')
  const [plazo, setPlazo] = React.useState<number | ''>('')
  const [obs, setObs] = React.useState('')

  const enviar = () => {
    abrirWhatsApp(
      msgCreditoDetalle(
        entidad,
        typeof monto === 'number' ? monto : undefined,
        typeof inicial === 'number' ? inicial : undefined,
        typeof plazo === 'number' ? plazo : undefined,
        obs
      )
    )
    onClose(); setObs('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Cotizar crédito">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block mb-1 text-gray-700">Entidad preferida</span>
          <select className="w-full rounded border p-2" value={entidad} onChange={e => setEntidad(e.target.value as EntidadCredito)}>
            <option>Indiferente</option><option>Addi</option><option>Sistecrédito</option><option>Cupo Brilla</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-gray-700">Monto (opcional)</span>
          <input type="number" min={0} className="w-full rounded border p-2" placeholder="Ej: 1500000" value={monto} onChange={e => setMonto(e.target.value === '' ? '' : Number(e.target.value))} />
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-gray-700">Cuota inicial (opcional)</span>
          <input type="number" min={0} className="w-full rounded border p-2" placeholder="Ej: 300000" value={inicial} onChange={e => setInicial(e.target.value === '' ? '' : Number(e.target.value))} />
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-gray-700">Plazo (meses)</span>
          <input type="number" min={0} className="w-full rounded border p-2" placeholder="Ej: 12" value={plazo} onChange={e => setPlazo(e.target.value === '' ? '' : Number(e.target.value))} />
        </label>

        <label className="col-span-2 text-sm">
          <span className="block mb-1 text-gray-700">Observaciones (opcional)</span>
          <textarea className="w-full rounded border p-2" rows={3} placeholder="Ingreso aproximado, horario para llamada, etc." value={obs} onChange={e => setObs(e.target.value)} />
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border px-4 py-2">Cancelar</button>
        <button onClick={enviar} className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700">Enviar a WhatsApp</button>
      </div>
    </Modal>
  )
}
