const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
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

Responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin backticks):
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

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: 'Eres un experto en desarrollo web y UX. Proporciona análisis concretos y accionables, nunca genéricos. Responde siempre con JSON válido sin markdown.',
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      const content = message.content[0].text;
      return JSON.parse(content);

    } catch (error) {
      console.error('Anthropic Service Error:', error);
      throw new Error('Error al procesar análisis con IA');
    }
  }
}

module.exports = OpenAIService;