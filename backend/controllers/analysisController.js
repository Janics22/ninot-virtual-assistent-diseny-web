const AnalysisService = require('../services/analysisService');

class AnalysisController {
  static async analyzeLocal(req, res, next) {
    try {
      const { url, localData } = req.body;

      if (!url || !localData) {
        return res.status(400).json({ error: 'Datos incompletos' });
      }

      const result = await AnalysisService.processLocalAnalysis(
        req.user.userId,
        url,
        localData
      );

      res.json(result);

    } catch (error) {
      next(error);
    }
  }

  static async analyzeAI(req, res, next) {
    try {
      const { url, html, localAnalysis } = req.body;

      if (!url || !html || !localAnalysis) {
        return res.status(400).json({ error: 'Datos incompletos' });
      }

      const result = await AnalysisService.processAIAnalysis(
        req.user.userId,
        url,
        html,
        localAnalysis
      );

      res.json(result);

    } catch (error) {
      next(error);
    }
  }
}

module.exports = AnalysisController;