# Code Pet - Extensión Chrome con Mascota Virtual Inteligente

Sistema completo de análisis de calidad web con mascota virtual animada que evalúa páginas en tiempo real.

## Características

### Modo Gratuito (Análisis Local)
- ✅ Análisis automático de cualquier página web
- ✅ Detección de problemas de accesibilidad
- ✅ Evaluación de UX y legibilidad
- ✅ Análisis de calidad de código
- ✅ Mascota animada con estados emocionales
- ✅ Panel flotante con resultados detallados

### Modo Premium (IA)
- Análisis avanzado con GPT-4o
- Sugerencias personalizadas y priorizadas
- Explicaciones detalladas de problemas
- Recomendaciones de optimización

## Estructura del Proyecto

```
code-pet/
│
├── extension/              # Extensión Chrome (Manifest v3)
│   ├── manifest.json
│   ├── content.js         # Script principal de análisis
│   ├── content.css        # Estilos de mascota y panel
│   ├── background.js      # Service worker
│   ├── popup.html         # Popup de autenticación
│   ├── popup.js
│   ├── popup.css
│   └── icons/             # Iconos de la extensión
│
└── backend/               # API Node.js + Express
    ├── server.js          # Servidor principal
    ├── db.js              # Conexión PostgreSQL
    ├── package.json
    ├── .env.example
    │
    ├── middleware/
    │   └── auth.js        # JWT middleware
    │
    ├── routes/
    │   ├── auth.js        # Login/Register
    │   ├── analyze.js     # Análisis premium con IA
    │   └── stripe.js      # Pagos y webhooks
    │
    └── migrations/
        └── init.js        # Setup inicial BD
```

## Instalación Rápida

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Configurar variables en .env
npm run migrate
npm start
```

### Extensión
```bash
cd extension
# Chrome -> chrome://extensions
# Activar "Modo desarrollador"
# "Cargar extensión sin empaquetar" -> seleccionar carpeta /extension
```

## Documentación

Ver [INSTALL.md](INSTALL.md) para instrucciones completas de configuración.

## 🔧 Stack Tecnológico

- **Frontend**: Vanilla JS, Chrome APIs, Manifest v3
- **Backend**: Node.js, Express, PostgreSQL, JWT, Stripe
- **IA**: OpenAI GPT-4o
- **Pagos**: Stripe Checkout + Webhooks

## Estados de la Mascota

- 😊 **Feliz** (80-100): Todo excelente
- 😐 **Neutral** (60-79): Bien pero mejorable
- 😟 **Preocupado** (40-59): Necesita mejoras
- 😰 **Alerta** (0-39): Muchos problemas
