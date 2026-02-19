const AnalysisModel = require('../models/analysisModel');
const UserModel = require('../models/userModel');
const OpenAIService = require('./claudeService');

class AnalysisService {
  static async processLocalAnalysis(userId, url, localData) {
    // Save to history
    const summary = {
      type: 'local',
      scores: localData.scores,
      issuesCount: localData.issues.length,
      timestamp: new Date()
    };

    await AnalysisModel.create(userId, url, summary);

    return {
      success: true,
      type: 'local',
      data: localData
    };
  }

  static async processAIAnalysis(userId, url, html, localAnalysis) {
    // Increment usage counter
    await UserModel.incrementAnalysisCount(userId);

    // Call OpenAI
    const aiAnalysis = await OpenAIService.analyzeWebPage(url, html, localAnalysis);

    // Save to history
    const summary = {
      type: 'ai',
      localScores: localAnalysis.scores,
      aiAnalysis: aiAnalysis,
      timestamp: new Date()
    };

    await AnalysisModel.create(userId, url, summary);

    return {
      success: true,
      type: 'ai',
      local: localAnalysis,
      ai: aiAnalysis
    };
  }

  static async getUserHistory(userId, limit = 20) {
    const history = await AnalysisModel.findByUserId(userId, limit);
    return history.map(h => ({
      id: h.id,
      url: h.url,
      type: h.summary.type,
      date: h.created_at,
      summary: h.summary
    }));
  }
}

module.exports = AnalysisService;