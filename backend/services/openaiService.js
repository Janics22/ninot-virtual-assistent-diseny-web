const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class OpenAIService {
  static async analyzeWebPage(url, html, localAnalysis) {
    try {
      // Sanitize HTML (limit to 30000 chars)
      const sanitizedHTML = html
        .substring(0, 30000)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

      const prompt = `Eres un experto en UX, accesibilidad y desarrollo web.

Analiza esta página y proporciona recomendaciones ACCIONABLES y ESPECÍFICAS:

URL: ${url}

Análisis local detectado:
- Problemas: ${localAnalysis.issues.length}
- Puntuaciones:
  * UX: ${localAnalysis.scores.ux}/100
  * Accesibilidad: ${localAnalysis.scores.accessibility}/100
  * Legibilidad: ${localAnalysis.scores.readability}/100
  * Código: ${localAnalysis.scores.codeQuality}/100

Problemas principales:
${localAnalysis.issues.slice(0, 10).map(i => `- [${i.severity}] ${i.message}`).join('\n')}

HTML (fragmento):
${sanitizedHTML}

Responde en JSON:
{
  "priority": "high|medium|low",
  "mainIssues": ["issue1", "issue2", "issue3"],
  "recommendations": [
    {
      "title": "Título corto",
      "description": "Descripción específica",
      "impact": "high|medium|low",
      "effort": "low|medium|high"
    }
  ],
  "quickWins": ["acción1", "acción2"],
  "summary": "Resumen ejecutivo en 2-3 líneas"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en desarrollo web y UX. Proporciona análisis concretos y accionables, nunca genéricos.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0].message.content;
      return JSON.parse(content);

    } catch (error) {
      console.error('OpenAI Service Error:', error);
      throw new Error('Error al procesar análisis con IA');
    }
  }
}

module.exports = OpenAIService;