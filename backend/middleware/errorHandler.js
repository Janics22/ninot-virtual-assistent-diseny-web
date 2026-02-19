const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Stripe errors
  if (err.type && err.type.startsWith('Stripe')) {
    return res.status(400).json({ 
      error: 'Error de pago',
      message: err.message 
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Error de validación',
      details: err.details 
    });
  }

  // Database errors
  if (err.code === '23505') { // Unique violation
    return res.status(400).json({ error: 'El email ya está registrado' });
  }

  // Default error
  res.status(err.status || 500).json({ 
    error: err.message || 'Error interno del servidor' 
  });
};

module.exports = errorHandler;