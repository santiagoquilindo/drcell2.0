import OpenAI from 'openai';
import { env } from '../config/env.js';
const MODEL = 'gpt-4o-mini';
const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
const LOCAL_RULES = [
    {
        keywords: ['agua', 'humedad', 'mojo', 'mojó', 'líquido', 'oxidacion'],
        resumen: 'Los síntomas apuntan a posible ingreso de líquido en los módulos internos.',
        probables_causas: [
            'Humedad u oxidación en placa principal o conectores flex',
            'Residuos que generan cortos al intentar cargar o encender',
        ],
        tips_en_casa: [
            'Apaga el dispositivo, retira accesorios y seca externamente sin aplicar calor directo',
            'Si es posible, retira la bandeja SIM para permitir que salga la humedad',
            'No conectes el cargador hasta que un técnico lo revise',
        ],
        pasos_tecnico: [
            'Acércanos el dispositivo en menos de 24 horas para desarmado y limpieza especializada',
            'Realizaremos una inspección completa de placa para determinar componentes afectados y documentar el diagnóstico',
        ],
        urgencia: 'alta',
        nota_garantia: 'Los equipos con humedad requieren evaluación técnica para validar cobertura.',
    },
    {
        keywords: ['pantalla', 'display', 'imagen', 'tactil', 'touch', 'líneas'],
        resumen: 'Hay indicios de falla en display o digitalizador.',
        probables_causas: [
            'Golpe o presión que afectó el módulo de pantalla',
            'Flex interno del display con falso contacto',
        ],
        tips_en_casa: [
            'Verifica en ajustes si hay actualizaciones o modo guantes activado',
            'Reinicia el equipo en modo seguro para descartar apps o filtros',
            'Limpia suavemente con microfibra seca para quitar polvo en sensores',
        ],
        pasos_tecnico: [
            'Aplicamos pruebas de imagen externa y test táctil en laboratorio',
            'Confirmamos si se requiere cambio de módulo o basta con reconectar y registramos el informe técnico',
        ],
        urgencia: 'media',
        nota_garantia: 'Pantallas fisuradas o con golpes no aplican a garantías de fábrica.',
    },
    {
        keywords: ['batería', 'cargar', 'carga', 'descarga', 'calienta', 'no carga'],
        resumen: 'El comportamiento describe problemas de alimentación o batería agotada.',
        probables_causas: [
            'Batería degradada con ciclos altos',
            'Puerto de carga sucio o controlador de energía dañado',
        ],
        tips_en_casa: [
            'Prueba con cargador y cable certificados conectados directo a pared',
            'Reinicia el equipo y activa modo avión 5 minutos para liberar consumo',
            'Inspecciona el puerto con luz y retira pelusas con aire o cepillo seco, sin objetos metálicos',
        ],
        pasos_tecnico: [
            'Medimos consumo y ciclos de la batería en laboratorio',
            'Limpiamos y probamos el puerto de carga con fuente regulada',
            'Verificamos integridad de la board de carga antes de cualquier reemplazo y entregamos el diagnóstico',
        ],
        urgencia: 'media',
        nota_garantia: 'Las baterías tienen garantías limitadas según desgaste reportado.',
    },
    {
        keywords: ['no enciende', 'no prende', 'no arranca', 'se apaga', 'reinicia'],
        resumen: 'La falla impide el arranque correcto del sistema.',
        probables_causas: [
            'Firmware dañado o actualización incompleta',
            'Short en board principal o conector flex desprendido',
        ],
        tips_en_casa: [
            'Mantén presionados power + volumen abajo 15 segundos para forzar reinicio',
            'Carga al menos 30 minutos con cargador original antes de intentar encender',
            'Retira SIM y SD para descartar bloqueos',
        ],
        pasos_tecnico: [
            'Realizamos diagnóstico de board y fuentes principales en laboratorio con registro fotográfico',
            'Respaldamos datos si el cliente lo autoriza antes de cualquier reparación mayor',
        ],
        urgencia: 'alta',
        nota_garantia: 'Se debe revisar en laboratorio para determinar si aplica garantía y entregar la inspección detallada.',
    },
];
function buildLocalSuggestion(input) {
    const text = `${input.motivo} ${input.descripcion}`.toLowerCase();
    const matchedRule = LOCAL_RULES.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)));
    const dispositivo = input.dispositivo ? `tu ${input.dispositivo}` : 'tu equipo';
    const similaresInfo = (input.similares ?? [])
        .map((item) => item.diagnostico || item.resultado)
        .filter((val) => Boolean(val && val.trim()))
        .slice(0, 2);
    const respuesta = matchedRule
        ? {
            resumen: `${matchedRule.resumen} Recomendamos revisar ${dispositivo} para confirmar el alcance real.`,
            probables_causas: [...matchedRule.probables_causas, ...similaresInfo],
            siguientes_pasos: [
                ...matchedRule.tips_en_casa,
                'Si después de estas pruebas persiste el fallo, visita un laboratorio certificado para evitar daños mayores y recibir una inspección completa.',
                ...matchedRule.pasos_tecnico,
            ],
            urgencia: matchedRule.urgencia,
            nota_garantia: matchedRule.nota_garantia,
        }
        : {
            resumen: `Realizamos una orientación inicial con la información suministrada para ${dispositivo}.`,
            probables_causas: [
                'Necesitamos medir voltajes y registrar síntomas en laboratorio para confirmar el origen.',
                ...similaresInfo,
            ],
            siguientes_pasos: [
                'Agenda una visita o envíanos el dispositivo para evaluación sin costo inicial',
                'Documenta fotos o videos del fallo para acelerar la revisión',
                'Confirma si el equipo tuvo golpes, humedad o reparaciones recientes',
            ],
            urgencia: 'media',
            nota_garantia: 'Validaremos garantías una vez se confirme el diagnóstico en laboratorio.',
        };
    return {
        prompt: 'LOCAL_RULES_FALLBACK',
        raw: JSON.stringify(respuesta),
        data: respuesta,
    };
}
export async function generateDiagnosticSuggestion(input) {
    if (!openai) {
        return buildLocalSuggestion(input);
    }
    const similares = (input.similares ?? [])
        .map((item, idx) => `${idx + 1}. Tipo: ${item.tipo}. Dispositivo: ${item.dispositivo ?? 'N/D'}. Motivo: ${item.descripcion ?? 'N/D'}. Diagnóstico/resolución: ${item.diagnostico ?? item.resultado ?? 'N/D'}`)
        .join('\n') || 'Sin antecedentes relevantes.';
    const prompt = `Eres un asesor técnico de Dr Cell. Debes orientar al cliente sobre el problema reportado.
Datos del cliente:
- Dispositivo: ${input.dispositivo ?? 'No especificado'}
- Motivo principal: ${input.motivo}
- Descripción completa: ${input.descripcion}

Historial de casos similares:
${similares}

Proporciona la respuesta en JSON con este formato:
{
  "resumen": "texto breve",
  "probables_causas": ["causa 1", "causa 2"],
  "siguientes_pasos": ["paso 1", "paso 2"],
  "urgencia": "alta|media|baja",
  "nota_garantia": "texto"
}
Agrega un tono empático y menciona que la revisión final se confirma en el laboratorio.`;
    const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        messages: [
            { role: 'system', content: 'Eres un asesor especializado en soporte técnico mobile en Colombia.' },
            { role: 'user', content: prompt },
        ],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) {
        throw new Error('La IA no generó una respuesta');
    }
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch (error) {
        parsed = {
            resumen: content,
            probables_causas: [],
            siguientes_pasos: [],
            urgencia: 'media',
            nota_garantia: 'Consulta nuestros términos de garantía en la tienda.',
        };
    }
    return {
        prompt,
        raw: content,
        data: parsed,
    };
}
