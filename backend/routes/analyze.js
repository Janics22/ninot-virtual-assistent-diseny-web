const express = require('express');
const OpenAI = require('openai');
const { authMiddleware, premiumMiddleware } = require('../middleware/auth');

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

router.post('/analyze-premium', authMiddleware, premiumMiddleware, async (req, res) => {
  const { url, html, localAnalysis } = req.body;

  if (!html || !localAnalysis) {
    return res.status(400).json({ error: 'Datos de análisis incompletos' });
  }

  try {
    const prompt = `Eres un experto en análisis de código web, UX y accesibilidad.

Analiza la siguiente página web y proporciona un análisis avanzado:

URL: ${url}

Análisis local detectado:
- Issues encontrados: ${localAnalysis.issues.length}
- Puntuaciones:
  * UX: ${localAnalysis.scores.ux}/100
  * Accesibilidad: ${localAnalysis.scores.accessibility}/100
  * Legibilidad: ${localAnalysis.scores.readability}/100
  * Calidad de código: ${localAnalysis.scores.codeQuality}/100

Problemas detectados:
${localAnalysis.issues.map(i => `- [${i.severity}] ${i.message}`).join('\n')}

HTML (primeros 50000 caracteres):
${html}

Proporciona:
1. Explicación detallada de los problemas más críticos
2. Priorización de qué arreglar primero y por qué
3. Sugerencias específicas de mejora
4. Impacto estimado de las correcciones

Responde en formato JSON con esta estructura:
{
  "explanation": "Explicación detallada",
  "priorities": "Lista priorizada de acciones",
  "suggestions": "Sugerencias específicas",
  "impact": "Impacto esperado"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Eres un experto en desarrollo web, accesibilidad y UX. Analizas código y proporcionas recomendaciones precisas y accionables.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const content = completion.choices[0].message.content;
    
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (parseError) {
      analysis = {
        explanation: content,
        priorities: 'Ver explicación completa',
        suggestions: 'Ver explicación completa',
        impact: 'Ver explicación completa'
      };
    }

    res.json(analysis);
  } catch (error) {
    console.error('Error en análisis premium:', error);
    res.status(500).json({ error: 'Error al realizar análisis premium' });
  }
});

module.exports = router;
