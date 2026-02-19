const CodeOptimizationService = require('../services/codeOptimizationService');
const UserModel = require('../models/userModel');

class CodeOptimizationController {
  static async optimizeCode(req, res, next) {
    console.log('🎨 Solicitud de optimización de código');
    console.log('👤 Usuario:', req.user.userId);
    
    try {
      const { code, language, accessibilityTarget } = req.body;

      if (!code || !language) {
        return res.status(400).json({ error: 'Código y lenguaje requeridos' });
      }

      // Validar lenguaje
      const validLanguages = ['html', 'css', 'javascript', 'react'];
      if (!validLanguages.includes(language.toLowerCase())) {
        return res.status(400).json({ 
          error: 'Lenguaje no soportado',
          supported: validLanguages 
        });
      }

      console.log('📝 Lenguaje:', language);
      console.log('🎯 Target:', accessibilityTarget || 'general');
      console.log('📏 Código length:', code.length);

      // Incrementar contador de uso
      await UserModel.incrementAnalysisCount(req.user.userId);

      // Optimizar código con IA
      const result = await CodeOptimizationService.optimizeCode(
        code,
        language,
        accessibilityTarget || 'general'
      );

      console.log('✅ Optimización completada');
      res.json(result);

    } catch (error) {
      console.error('❌ Error en optimización:', error);
      next(error);
    }
  }

  static async analyzeAccessibility(req, res, next) {
    try {
      const { html, css, target } = req.body;

      if (!html) {
        return res.status(400).json({ error: 'HTML requerido' });
      }

      const result = await CodeOptimizationService.analyzeAccessibility(
        html,
        css || '',
        target || 'general'
      );

      res.json(result);

    } catch (error) {
      console.error('❌ Error en análisis:', error);
      next(error);
    }
  }
}

module.exports = CodeOptimizationController;