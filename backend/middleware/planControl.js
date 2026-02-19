const UserModel = require('../models/userModel');

const planControl = (requiredPlan = 'pro') => {
  return async (req, res, next) => {
    try {
      const user = await UserModel.findById(req.user.userId);

      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Check if period expired - reset counter
      if (user.current_period_end && new Date(user.current_period_end) < new Date()) {
        await UserModel.resetAnalysisCount(user.id);
        user.analyses_count = 0;
      }

      // Attach user data to request
      req.userData = user;

      // Check plan requirement
      if (requiredPlan === 'pro' && user.plan !== 'pro') {
        return res.status(403).json({ 
          error: 'Plan PRO requerido',
          code: 'PLAN_REQUIRED',
          currentPlan: user.plan
        });
      }

      next();
    } catch (error) {
      console.error('Plan control error:', error);
      res.status(500).json({ error: 'Error verificando plan' });
    }
  };
};

const usageControl = (limitType = 'pro') => {
  return async (req, res, next) => {
    const user = req.userData;

    const limits = {
      free: parseInt(process.env.FREE_ANALYSES_PER_MONTH) || 5,
      pro: parseInt(process.env.PRO_ANALYSES_PER_MONTH) || 200
    };

    const limit = limits[user.plan] || limits.free;

    if (user.analyses_count >= limit) {
      return res.status(429).json({ 
        error: 'Límite de análisis alcanzado',
        code: 'LIMIT_REACHED',
        limit,
        used: user.analyses_count,
        resetDate: user.current_period_end
      });
    }

    next();
  };
};

module.exports = { planControl, usageControl };