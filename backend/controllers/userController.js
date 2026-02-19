const UserModel = require('../models/userModel');
const AnalysisModel = require('../models/analysisModel');

class UserController {
  static async getProfile(req, res, next) {
    try {
      const user = await UserModel.findById(req.user.userId);

      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Check if period expired
      if (user.current_period_end && new Date(user.current_period_end) < new Date()) {
        await UserModel.resetAnalysisCount(user.id);
        user.analyses_count = 0;
      }

      // Get monthly usage
      const monthlyCount = await AnalysisModel.getMonthlyCount(user.id);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          plan: user.plan,
          usage: {
            current: user.analyses_count,
            limit: user.plan === 'pro' ? 200 : 5,
            resetDate: user.current_period_end
          },
          monthlyAnalyses: monthlyCount
        }
      });

    } catch (error) {
      next(error);
    }
  }

  static async getHistory(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const history = await AnalysisModel.findByUserId(req.user.userId, limit);

      res.json({
        success: true,
        history: history.map(h => ({
          id: h.id,
          url: h.url,
          type: h.summary.type || 'local',
          date: h.created_at,
          preview: h.summary
        }))
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;