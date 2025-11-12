import OpenAI from 'openai';
import { env } from '../config/env.js';
const MODEL = 'gpt-4o-mini';
const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
export async function generateDiagnosticSuggestion(input) {
    if (!openai) {
        throw new Error('AI service not configured');
    }
    const similares = (input.similares ?? [])
        .map((item, idx) => `${idx + 1}. Tipo: ${item.tipo}. Dispositivo: ${item.dispositivo ?? 'N/D'}. Motivo: ${item.descripcion ?? 'N/D'}. Diagnóstico/resolución: ${item.diagnostico ?? item.resultado ?? 'N/D'}`)
        .join('\n') || 'Sin antecedentes relevantes.';
    const prompt = `Eres un asesor técnico de Doctor Cell 2.0. Debes orientar al cliente sobre el problema reportado.
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
