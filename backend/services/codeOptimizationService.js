const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function splitCodeAndCSS(code) {
  let html = code, css = '';
  const cssSplit = code.match(/<!-- CSS -->\s*<style>([\s\S]*?)<\/style>/i);
  if (cssSplit) {
    css  = cssSplit[1].trim();
    html = code
      .replace(/<!-- CÓDIGO \([^)]+\) -->\s*/, '')
      .replace(/<!-- CSS -->\s*<style>[\s\S]*?<\/style>/i, '')
      .trim();
  }
  return { html, css };
}

// Parsea el formato de texto plano que devuelve Claude para el análisis
// Formato: BEFORE_SCORE:45|BEFORE_WCAG:F|AFTER_SCORE:88|AFTER_WCAG:AA|SUMMARY:texto
// ERRORS: severity~type~mensaje (una por línea)
// CHANGES: categoria~descripcion~razon (una por línea)
function parseAnalysisText(raw) {
  const result = {
    beforeScore: 0, beforeWcag: 'F',
    afterScore: 85,  afterWcag: 'AA',
    summary: '', errors: [], changes: []
  };

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (line.startsWith('BEFORE_SCORE:'))  result.beforeScore = parseInt(line.split(':')[1]) || 0;
    if (line.startsWith('BEFORE_WCAG:'))   result.beforeWcag  = line.split(':')[1].trim();
    if (line.startsWith('AFTER_SCORE:'))   result.afterScore  = parseInt(line.split(':')[1]) || 85;
    if (line.startsWith('AFTER_WCAG:'))    result.afterWcag   = line.split(':')[1].trim();
    if (line.startsWith('SUMMARY:'))       result.summary     = line.substring(8).trim();

    if (line.startsWith('ERROR:')) {
      const parts = line.substring(6).split('~');
      if (parts.length >= 3) {
        result.errors.push({ severity: parts[0].trim(), type: parts[1].trim(), message: parts[2].trim() });
      }
    }

    if (line.startsWith('CHANGE:')) {
      const parts = line.substring(7).split('~');
      if (parts.length >= 3) {
        result.changes.push({ category: parts[0].trim(), description: parts[1].trim(), reason: parts[2].trim() });
      }
    }
  }

  return result;
}

class CodeOptimizationService {

  static async analyzeOnly(htmlInput, cssInput, targetAudience, language) {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: `Eres un auditor de accesibilidad WCAG 2.1. Responde ÚNICAMENTE en el formato de texto indicado, sin JSON, sin markdown.`,
      messages: [{
        role: 'user',
        content: `Audita este código ${language} para ${targetAudience}.
Responde SOLO en este formato de texto, una línea por campo:

BEFORE_SCORE:45
BEFORE_WCAG:F
SUMMARY:descripción breve del estado del código
ERROR:critical~contrast~Descripción del error 1
ERROR:medium~semantic~Descripción del error 2
ERROR:low~performance~Descripción del error 3

Identifica TODOS los errores que encuentres, sin límite. Sin JSON. Sin markdown. Solo el formato anterior.

HTML:
${htmlInput.substring(0, 3500)}
${cssInput ? `CSS:\n${cssInput.substring(0, 1200)}` : ''}`
      }]
    });

    const parsed = parseAnalysisText(msg.content[0].text);
    console.log('📊 analyzeOnly:', parsed.beforeScore, parsed.beforeWcag);
    return {
      wcagLevel: parsed.beforeWcag,
      accessibilityScore: parsed.beforeScore,
      summary: parsed.summary,
      errors: parsed.errors.map(e => ({ type: e.type, severity: e.severity, message: e.message, line: 0, impact: '' })),
      changes: []
    };
  }

  static async optimizeCode(code, language, accessibilityTarget = 'general', analyzeOnly = false) {
    const accessibilityProfiles = {
      general:    'público general con buenas prácticas de accesibilidad',
      blind:      'personas ciegas que usan lectores de pantalla',
      colorblind: 'personas daltónicas (deuteranopia, protanopia, tritanopia)',
      lowVision:  'personas con baja visión',
      motor:      'personas con discapacidades motoras',
      cognitive:  'personas con discapacidades cognitivas',
      deaf:       'personas sordas o con problemas auditivos'
    };

    const targetAudience = accessibilityProfiles[accessibilityTarget] || accessibilityProfiles.general;
    const { html: rawHTML, css: rawCSS } = splitCodeAndCSS(code);
    const htmlInput = rawHTML.substring(0, 4000);
    const cssInput  = rawCSS.substring(0, 1500);

    try {
      if (analyzeOnly) {
        const r = await CodeOptimizationService.analyzeOnly(htmlInput, cssInput, targetAudience, language);
        return { success: true, target: accessibilityTarget, ...r };
      }

      // ── LLAMADA 1: Análisis en texto plano (nunca se corta) ───────────────
      const analysisMsg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: `Eres un auditor de accesibilidad WCAG 2.1. Responde ÚNICAMENTE en el formato de texto indicado. Sin JSON. Sin markdown.`,
        messages: [{
          role: 'user',
          content: `Audita este código ${language} para ${targetAudience} y estima las métricas antes Y después de optimizar.
Responde SOLO en este formato exacto, una línea por campo:

BEFORE_SCORE:30
BEFORE_WCAG:F
AFTER_SCORE:88
AFTER_WCAG:AA
SUMMARY:descripción breve de las mejoras realizadas
ERROR:critical~contrast~El texto tiene ratio de contraste insuficiente
ERROR:medium~semantic~Falta estructura HTML5 semántica
CHANGE:Contraste~Mejorar ratios de color a mínimo 4.5:1~Cumple WCAG 1.4.3 nivel AA
CHANGE:Semántica~Reemplazar divs por elementos HTML5~Mejora accesibilidad lectores pantalla

Identifica TODOS los errores que encuentres. Máximo 10 cambios. Sin JSON. Sin markdown. Solo el formato anterior.

HTML:
${htmlInput}
${cssInput ? `CSS:\n${cssInput}` : ''}`
        }]
      });

      const analysis = parseAnalysisText(analysisMsg.content[0].text);
      console.log('📊 Antes:', analysis.beforeScore, '→ Después:', analysis.afterScore);

      // ── LLAMADA 2: HTML optimizado ─────────────────────────────────────────
      const htmlMsg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 6000,
        system: `Experto en accesibilidad WCAG 2.1 para ${targetAudience}.
Devuelve ÚNICAMENTE el HTML optimizado. Sin etiquetas <style>. Sin explicaciones. Sin markdown. Solo HTML puro.`,
        messages: [{
          role: 'user',
          content: `Optimiza este HTML para ${targetAudience}. Corrige semántica, ARIA, estructura.
Devuelve SOLO el HTML. Sin <style> embebido. Sin explicaciones.

${htmlInput}`
        }]
      });

      const optimizedHTML = htmlMsg.content[0].text
        .replace(/^```[\w]*\n?/i, '').replace(/```\s*$/i, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .trim();

      // ── LLAMADA 3: CSS optimizado ──────────────────────────────────────────
      let optimizedCSS = '';
      if (cssInput) {
        const cssMsg = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000,
          system: `Experto en CSS accesible para ${targetAudience}.
Devuelve ÚNICAMENTE el CSS optimizado. Sin etiquetas <style>. Sin explicaciones. Sin markdown. Solo CSS puro.`,
          messages: [{
            role: 'user',
            content: `Optimiza este CSS para ${targetAudience} según WCAG 2.1.
Corrige: ratios de contraste (mínimo 4.5:1), fuentes mínimo 1rem, focus visible, espaciado.
Actualiza selectores para que coincidan con el HTML optimizado.
Devuelve SOLO CSS puro. Sin <style>.

CSS original:
${cssInput}

HTML optimizado (para contexto de selectores):
${optimizedHTML.substring(0, 2000)}`
          }]
        });

        optimizedCSS = cssMsg.content[0].text
          .replace(/^```[\w]*\n?/i, '').replace(/```\s*$/i, '')
          .replace(/<\/?style[^>]*>/gi, '')
          .trim();
      }

      console.log('✅ HTML:', optimizedHTML.length, '| CSS:', optimizedCSS.length);

      return {
        success: true,
        target: accessibilityTarget,
        targetDescription: targetAudience,
        optimizedCode: optimizedHTML,
        optimizedCSS:  optimizedCSS,
        beforeScore:   analysis.beforeScore,
        beforeWcag:    analysis.beforeWcag,
        wcagLevel:          analysis.afterWcag,
        accessibilityScore: analysis.afterScore,
        summary: analysis.summary || 'Código optimizado para accesibilidad',
        errors:  analysis.errors.map(e => ({ type: e.type, severity: e.severity, message: e.message, line: 0, impact: '' })),
        changes: analysis.changes.map(c => ({ category: c.category, description: c.description, reason: c.reason }))
      };

    } catch (error) {
      console.error('❌ Error:', error.message);
      throw new Error('Error al procesar optimización con IA: ' + error.message);
    }
  }

  static async analyzeAccessibility(html, css, target = 'general') {
    const targetLabel = target === 'blind' ? 'ciegas' : target === 'colorblind' ? 'daltónicas' : 'en general';
    try {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: 'Experto accesibilidad web. Responde SOLO en formato texto, sin JSON.',
        messages: [{
          role: 'user',
          content: `Accesibilidad para personas ${targetLabel}. Responde SOLO en este formato:
SCORE:85
WCAG:AA
ISSUE:problema 1
ISSUE:problema 2
REC:recomendación 1

HTML: ${html.substring(0, 2500)}
CSS: ${css.substring(0, 800)}`
        }]
      });

      const lines = msg.content[0].text.split('\n').map(l => l.trim()).filter(Boolean);
      const result = { score: 75, wcagLevel: 'AA', issues: [], recommendations: [] };
      for (const line of lines) {
        if (line.startsWith('SCORE:'))  result.score     = parseInt(line.split(':')[1]) || 75;
        if (line.startsWith('WCAG:'))   result.wcagLevel = line.split(':')[1].trim();
        if (line.startsWith('ISSUE:'))  result.issues.push(line.substring(6).trim());
        if (line.startsWith('REC:'))    result.recommendations.push(line.substring(4).trim());
      }
      return result;

    } catch (error) {
      throw new Error('Error al analizar accesibilidad: ' + error.message);
    }
  }
}

module.exports = CodeOptimizationService;