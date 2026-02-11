const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const analyzeRoutes = require('./routes/analyze');
const stripeRoutes = require('./routes/stripe');

const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'chrome-extension://*'],
  credentials: true
}));

app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'Code Pet API' });
});

app.use('/auth', authRoutes);
app.use('/', analyzeRoutes);
app.use('/', stripeRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
});
