import React from 'react'
import { MapPin, Phone, Instagram, Facebook, Send, MessageCircle, PlayCircle } from 'lucide-react'
import { ENV } from '@utils/env'

type Props = {
  onOpenTerminos: () => void
  onOpenDatos: () => void
  onOpenCookies: () => void
  onOpenGarantias: () => void
  onLocation: () => void
}

export const Footer: React.FC<Props> = ({
  onOpenTerminos,
  onOpenDatos,
  onOpenCookies,
  onOpenGarantias,
  onLocation
}) => {
  return (
    <footer className="bg-white border-t text-neutral-800 py-10 mt-12">
      <div className="container mx-auto px-4 grid md:grid-cols-3 gap-6 items-start">
        <div className="text-center md:text-left">
          <h3 className="text-xl font-bold text-green-700 mb-2">Doctor Cell 2.0</h3>
          <p className="text-gray-600 mb-2">Tu aliado en tecnología móvil en Popayán</p>

          <button
            onClick={onLocation}
            className="flex items-center gap-2 text-green-700 hover:text-green-800 mx-auto md:mx-0"
          >
            <MapPin size={16} /> Local 4 – El Bostezo
          </button>

          <a
            href={`tel:+${ENV.WHATSAPP_E164}`}
            className="flex items-center gap-2 text-green-700 hover:text-green-800 mt-2 mx-auto md:mx-0"
          >
            <Phone size={16} /> 312 265 0861
          </a>

          <div className="mt-2 text-sm text-gray-600">
            <p>NIT {ENV.NIT}</p>
            <p>
              Correo:{' '}
              <a className="underline text-green-700 hover:text-green-800" href={`mailto:${ENV.EMAIL}`}>
                {ENV.EMAIL}
              </a>
            </p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600 mb-3">Síguenos</p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://instagram.com/doctorcell2"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-full border border-gray-300 hover:border-green-600"
            >
              <Instagram />
            </a>

            <a
              href="https://facebook.com/doctorcell2"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-full border border-gray-300 hover:border-green-600"
            >
              <Facebook />
            </a>

            <a
              href="https://t.me/doctorcell2"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-full border border-gray-300 hover:border-green-600"
            >
              <Send />
            </a>

            <a
              href={`https://wa.me/${ENV.WHATSAPP_E164}`}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-full border border-gray-300 hover:border-green-600"
            >
              <MessageCircle />
            </a>

            <a
              href="https://www.tiktok.com/@doctorcell2"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-full border border-gray-300 hover:border-green-600"
            >
              <PlayCircle />
            </a>
          </div>
        </div>

        <div className="text-center md:text-right text-sm text-gray-600">
          <p>© {new Date().getFullYear()} Doctor Cell 2.0 – Todos los derechos reservados</p>
          <div className="mt-3 flex flex-wrap md:justify-end justify-center gap-3 text-green-700">
            <button onClick={onOpenTerminos} className="underline hover:text-green-800">
              Términos y Condiciones
            </button>
            <button onClick={onOpenDatos} className="underline hover:text-green-800">
              Tratamiento de Datos
            </button>
            <button onClick={onOpenCookies} className="underline hover:text-green-800">
              Cookies
            </button>
            <button onClick={onOpenGarantias} className="underline hover:text-green-800">
              Garantías y Devoluciones
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
