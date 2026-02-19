const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class CodeOptimizationService {
  static async optimizeCode(code, language, accessibilityTarget = 'general') {
    try {
      const accessibilityProfiles = {
        general: 'público general con buenas prácticas de accesibilidad',
        blind: 'personas ciegas que usan lectores de pantalla',
        colorblind: 'personas daltónicas (deuteranopia, protanopia, tritanopia)',
        lowVision: 'personas con baja visión',
        motor: 'personas con discapacidades motoras',
        cognitive: 'personas con discapacidades cognitivas',
        deaf: 'personas sordas o con problemas auditivos'
      };

      const targetAudience = accessibilityProfiles[accessibilityTarget] || accessibilityProfiles.general;

      const prompt = `Eres un experto en desarrollo web, UX/UI y accesibilidad WCAG 2.1 AAA.

TAREA: Optimizar el siguiente código ${language} para ${targetAudience}.

CÓDIGO ORIGINAL:
\`\`\`${language}
${code}
\`\`\`

ANÁLISIS REQUERIDO:

1. ERRORES DE DISEÑO (críticos, medios, bajos):
   - Problemas de accesibilidad específicos
   - Errores de semántica HTML
   - Problemas de contraste de color
   - Errores de estructura
   - Problemas de rendimiento

2. CÓDIGO OPTIMIZADO:
   - Corregir todos los errores
   - Optimizar para ${targetAudience}
   - Mejorar semántica
   - Añadir ARIA labels donde sea necesario
   - Optimizar contraste de colores
   - Mejorar estructura y legibilidad

3. EXPLICACIÓN:
   - Qué se cambió y por qué
   - Beneficios específicos para ${targetAudience}
   - Nivel de conformidad WCAG alcanzado

Responde en JSON:
{
  "errors": [
    {
      "type": "accessibility|semantic|visual|performance",
      "severity": "critical|medium|low",
      "message": "Descripción del error",
      "line": número_aproximado,
      "impact": "Impacto en ${targetAudience}"
    }
  ],
  "optimizedCode": "código completamente optimizado",
  "changes": [
    {
      "category": "Categoría del cambio",
      "description": "Qué se cambió",
      "reason": "Por qué es importante para ${targetAudience}"
    }
  ],
  "wcagLevel": "A|AA|AAA",
  "accessibilityScore": 0-100,
  "summary": "Resumen ejecutivo de las mejoras"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Eres un experto en desarrollo web accesible. Tu objetivo es optimizar código para que sea accesible según WCAG 2.1 y específicamente para ${targetAudience}.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0].message.content);
      
      return {
        success: true,
        target: accessibilityTarget,
        targetDescription: targetAudience,
        ...result
      };

    } catch (error) {
      console.error('Error en optimización de código:', error);
      throw new Error('Error al procesar optimización con IA');
    }
  }

  static async analyzeAccessibility(html, css, target = 'general') {
    try {
      const prompt = `Analiza la accesibilidad del siguiente código para personas ${target === 'blind' ? 'ciegas' : target === 'colorblind' ? 'daltónicas' : 'en general'}:

HTML:
\`\`\`html
${html}
\`\`\`

CSS:
\`\`\`css
${css}
\`\`\`

Responde en JSON con:
{
  "score": 0-100,
  "issues": ["problema1", "problema2"],
  "recommendations": ["recomendación1", "recomendación2"],
  "wcagLevel": "A|AA|AAA"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      console.error('Error en análisis de accesibilidad:', error);
      throw error;
    }
  }
}

module.exports = CodeOptimizationService;