require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const analysisRoutes = require('./routes/analysis');
const stripeRoutes = require('./routes/stripe');
const codeOptimizationRoutes = require('./routes/codeOptimization');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ============================================
// SECURITY & MIDDLEWARE
// ============================================

app.use(helmet());

// CORS — acepta cualquier chrome-extension y localhost
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (Postman, curl, etc.)
    if (!origin) return callback(null, true);

    // Permitir extensiones de Chrome
    if (origin.startsWith('chrome-extension://')) return callback(null, true);

    // Permitir localhost en cualquier puerto
    if (origin.startsWith('http://localhost')) return callback(null, true);

    // Permitir frontend URL si está configurada
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }

    callback(new Error(`CORS bloqueado: ${origin}`));
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes, intenta de nuevo más tarde'
});

app.use('/auth', limiter);

// Body parser — webhook necesita raw body
app.use((req, res, next) => {
  if (req.originalUrl === '/stripe/webhook') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true }));

// ============================================
// ROUTES
// ============================================

app.get('/', (req, res) => {
  res.json({
    message: 'Code Pet API v2.0',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/analysis', analysisRoutes);
app.use('/stripe', stripeRoutes);
app.use('/code', codeOptimizationRoutes);

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

app.use(errorHandler);

// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Code Pet Backend SaaS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Configured' : 'Not configured'}`);
  console.log(`🤖 Anthropic: ${process.env.ANTHROPIC_API_KEY ? 'Configured' : 'Not configured'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});