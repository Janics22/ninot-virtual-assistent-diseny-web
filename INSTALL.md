# Code Pet - Guía de Instalación Completa

## Requisitos Previos

- Node.js 16+ y npm
- PostgreSQL 12+
- Cuenta Stripe (modo test)
- API Key de OpenAI

## Configuración del Backend

### 1. Instalar dependencias

```bash
cd backend
npm install
```

### 2. Configurar PostgreSQL

Crear base de datos:

```sql
CREATE DATABASE codepet;
CREATE USER codepet_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE codepet TO codepet_user;
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:

```env
PORT=3000

DATABASE_URL=postgresql://codepet_user:your_password@localhost:5432/codepet

JWT_SECRET=genera-un-secret-aleatorio-seguro

STRIPE_SECRET_KEY=sk_test_... # Desde Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_... # Desde Stripe CLI o Dashboard
STRIPE_PRICE_ID=price_... # Crear producto en Stripe

OPENAI_API_KEY=sk-... # Desde OpenAI Platform

FRONTEND_URL=http://localhost
```

### 4. Configurar Stripe

#### Crear Producto en Stripe Dashboard

1. Ir a https://dashboard.stripe.com/test/products
2. Crear producto "Code Pet Premium"
3. Precio: $9.99/mes recurrente
4. Copiar el `PRICE_ID` a `.env`

#### Configurar Webhook (desarrollo local)

Opción A - Stripe CLI (recomendado):

```bash
stripe listen --forward-to localhost:3000/webhook
# Copiar el webhook secret (whsec_...) a .env
```

Opción B - ngrok + Dashboard:

```bash
ngrok http 3000
# Usar URL en Stripe Dashboard webhook settings
```

### 5. Ejecutar migraciones

```bash
npm run migrate
```

### 6. Iniciar servidor

```bash
npm start
# O para desarrollo con auto-reload:
npm run dev
```

Servidor corriendo en: http://localhost:3000

## Configuración de la Extensión

### 1. Actualizar URL del API

Editar `extension/content.js` y `extension/popup.js`:

```javascript
const API_URL = 'http://localhost:3000';
```

Si usas ngrok, cambiar a tu URL pública.

### 2. Generar iconos (opcional)

Crear iconos PNG simples o usar https://favicon.io/

Colocar en:
- `extension/icons/icon16.png`
- `extension/icons/icon48.png`
- `extension/icons/icon128.png`

### 3. Cargar extensión en Chrome

1. Abrir Chrome: `chrome://extensions`
2. Activar "Modo de desarrollador"
3. Click en "Cargar extensión sin empaquetar"
4. Seleccionar carpeta `/extension`

### 4. Actualizar ID de extensión (para CORS)

Después de cargar la extensión:

1. Copiar el ID de extensión (ej: `abcdefghijklmnopqrstuvwxyz123456`)
2. Actualizar `.env` del backend:

```env
FRONTEND_URL=chrome-extension://abcdefghijklmnopqrstuvwxyz123456
```

3. Reiniciar servidor backend

## Uso

### 1. Navegar a cualquier sitio web

La mascota aparecerá automáticamente en la esquina inferior derecha.

### 2. Ver análisis local (gratuito)

Click en la mascota para ver el panel con:
- Puntuaciones de UX, accesibilidad, legibilidad, código
- Lista de problemas detectados

### 3. Registrarse/Login

Click en "Iniciar Sesión" en el panel o en el popup de la extensión.

### 4. Suscribirse a Premium

En el popup:
1. Click en "Suscribirse a Premium"
2. Completa el pago en Stripe (usa tarjeta de test: `4242 4242 4242 4242`)
3. Regresa a la extensión

### 5. Análisis Premium con IA

En cualquier página:
1. Click en la mascota
2. Click en "✨ Análisis Inteligente (Premium)"
3. Espera el análisis detallado con IA

## Tarjetas de Test de Stripe

- Éxito: `4242 4242 4242 4242`
- Requiere autenticación: `4000 0025 0000 3155`
- Declinada: `4000 0000 0000 9995`

Fecha: Cualquier futura
CVC: Cualquier 3 dígitos

## Troubleshooting

### Error CORS

Verificar que `FRONTEND_URL` en `.env` coincida con el ID de la extensión.

### Webhook no funciona

- Verificar que `STRIPE_WEBHOOK_SECRET` esté correcto
- Si usas Stripe CLI, debe estar ejecutándose
- Verificar logs del servidor cuando Stripe envía eventos

### Base de datos no conecta

- Verificar que PostgreSQL esté corriendo: `pg_isready`
- Verificar credenciales en `DATABASE_URL`
- Verificar que la base de datos exista: `psql -l`

### Análisis premium no funciona

- Verificar `OPENAI_API_KEY` en `.env`
- Verificar que la cuenta OpenAI tenga créditos
- Revisar logs del servidor para errores de OpenAI

### La mascota no aparece en la página

- Verificar que la extensión esté activa
- Refrescar la página (F5)
- Revisar consola del navegador para errores

## Arquitectura del Sistema

```
┌─────────────────┐
│  Chrome Browser │
│                 │
│  ┌───────────┐  │
│  │ Extension │  │──┐
│  │           │  │  │
│  │ Content   │  │  │ HTTP/HTTPS
│  │ Script    │  │  │
│  └───────────┘  │  │
└─────────────────┘  │
                     │
                     ▼
              ┌──────────────┐
              │   Backend    │
              │  Express.js  │
              │              │
              │  ┌────────┐  │
              │  │  Auth  │  │
              │  │  JWT   │  │
              │  └────────┘  │
              │              │
              │  ┌────────┐  │
              │  │ Stripe │  │
              │  │Payment │  │
              │  └────────┘  │
              │              │
              │  ┌────────┐  │
              │  │ OpenAI │  │
              │  │  GPT   │  │
              │  └────────┘  │
              └──────────────┘
                     │
                     ▼
              ┌──────────────┐
              │ PostgreSQL   │
              │              │
              │   users      │
              └──────────────┘
```

## Flujo de Análisis

### Modo Gratuito (Local)

1. Content script captura HTML de la página
2. Ejecuta análisis estático en el navegador
3. Detecta problemas básicos
4. Calcula puntuaciones
5. Actualiza UI de la mascota

### Modo Premium (IA)

1. Usuario autenticado como premium
2. Click en "Análisis Inteligente"
3. Envía análisis local + HTML al backend
4. Backend valida JWT
5. Backend consulta OpenAI GPT-4o
6. GPT analiza y genera recomendaciones
7. Backend devuelve análisis avanzado
8. Extensión muestra resultados

## Seguridad

✅ API Key de OpenAI solo en backend
✅ JWT para autenticación
✅ Verificación de firma Stripe webhook
✅ CORS configurado correctamente
✅ Contraseñas hasheadas con bcrypt
✅ Validación de roles en rutas premium

## Próximos Pasos

- Implementar caché de análisis
- Agregar historial de análisis
- Exportar reportes en PDF
- Análisis comparativo entre páginas
- Dashboard web completo
- Integración con más LLMs