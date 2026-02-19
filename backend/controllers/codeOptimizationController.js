const CodeOptimizationService = require('../services/codeOptimizationService');

class CodeOptimizationController {
  static async optimizeCode(req, res) {
    try {
      const { code, language, accessibilityTarget, analyzeOnly } = req.body;

      if (!code) return res.status(400).json({ error: 'El código es requerido' });
      if (!language) return res.status(400).json({ error: 'El lenguaje es requerido' });

      const result = await CodeOptimizationService.optimizeCode(
        code,
        language,
        accessibilityTarget || 'general',
        analyzeOnly === true  // pasa el flag al service
      );

      res.json(result);
    } catch (error) {
      console.error('Error en optimización:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async analyzeAccessibility(req, res) {
    try {
      const { html, css, target } = req.body;
      if (!html) return res.status(400).json({ error: 'El HTML es requerido' });

      const result = await CodeOptimizationService.analyzeAccessibility(html, css || '', target || 'general');
      res.json(result);
    } catch (error) {
      console.error('Error en análisis:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = CodeOptimizationController;