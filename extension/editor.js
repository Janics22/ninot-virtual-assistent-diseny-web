// Editor PRO - Code Optimization with AI

const API_URL = 'http://localhost:3000';

let authToken = null;
let userEmail = null;
let currentLanguage = 'html';
let currentResult = null;

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Load auth state
  const data = await chrome.storage.local.get(['authToken', 'userEmail', 'userPlan']);
  authToken = data.authToken;
  userEmail = data.userEmail;
  
  if (!authToken || data.userPlan !== 'pro') {
    alert('Debes ser usuario PRO para acceder al editor');
    window.close();
    return;
  }
  
  document.getElementById('user-email').textContent = userEmail;
  
  setupEventListeners();
  loadSampleCode();
}

function setupEventListeners() {
  // Language selector
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', handleLanguageChange);
  });
  
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', handleTabChange);
  });
  
  // Buttons
  document.getElementById('optimize-btn').addEventListener('click', optimizeCode);
  document.getElementById('clear-btn').addEventListener('click', clearCode);
  document.getElementById('copy-btn').addEventListener('click', copyOptimizedCode);
  document.getElementById('back-btn').addEventListener('click', () => window.close());
  
  // Auto-update preview
  document.getElementById('optimized-code').addEventListener('input', updatePreview);
}

function handleLanguageChange(e) {
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  currentLanguage = e.target.dataset.lang;
  loadSampleCode();
}

function handleTabChange(e) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  
  e.target.classList.add('active');
  document.getElementById(`${e.target.dataset.tab}-tab`).classList.add('active');
}

function loadSampleCode() {
  const samples = {
    html: `<!DOCTYPE html>
<html>
<head>
  <title>Mi Página</title>
</head>
<body>
  <div>
    <img src="logo.png">
    <h1 style="color: #ccc;">Bienvenido</h1>
    <a href="#">Click aquí</a>
  </div>
</body>
</html>`,
    css: `body {
  background: white;
  color: #ccc;
}

.button {
  background: red;
  color: white;
}

div {
  font-size: 10px;
}`,
    javascript: `function handleClick() {
  document.getElementById('content').innerHTML = 'Nuevo contenido';
}

// Sin manejo de errores
const data = JSON.parse(response);`,
    react: `function MyComponent() {
  return (
    <div>
      <img src="logo.png" />
      <button onClick={() => alert('click')}>
        Click
      </button>
    </div>
  );
}`
  };
  
  document.getElementById('original-code').value = samples[currentLanguage] || '';
}

function clearCode() {
  document.getElementById('original-code').value = '';
  document.getElementById('optimized-code').value = '';
  currentResult = null;
  showEmptyState('errors');
  showEmptyState('changes');
}

async function optimizeCode() {
  const code = document.getElementById('original-code').value.trim();
  
  if (!code) {
    alert('Por favor escribe o pega código primero');
    return;
  }
  
  const target = document.getElementById('accessibility-target').value;
  const btn = document.getElementById('optimize-btn');
  
  btn.disabled = true;
  btn.textContent = '⏳ Optimizando...';
  showLoading(true);
  
  try {
    const response = await fetch(`${API_URL}/code/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        code,
        language: currentLanguage,
        accessibilityTarget: target
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      if (data.code === 'LIMIT_REACHED') {
        alert(`Límite alcanzado: ${data.used}/${data.limit} análisis este mes`);
      } else if (data.code === 'PLAN_REQUIRED') {
        alert('Necesitas plan PRO para esta función');
      } else {
        throw new Error(data.error || 'Error al optimizar código');
      }
      return;
    }
    
    currentResult = data;
    displayResults(data);
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Optimizar con IA';
    showLoading(false);
  }
}

function displayResults(data) {
  // Show optimized code
  document.getElementById('optimized-code').value = data.optimizedCode;
  
  // Show errors
  displayErrors(data.errors);
  
  // Show changes
  displayChanges(data.changes, data);
  
  // Update preview
  updatePreview();
  
  // Show summary
  displaySummary(data);
}

function displayErrors(errors) {
  const container = document.getElementById('errors-tab');
  
  if (!errors || errors.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <p>¡No se encontraron errores críticos!</p>
      </div>
    `;
    return;
  }
  
  const html = `
    <div class="error-list">
      ${errors.map(error => `
        <div class="error-item ${error.severity}">
          <div class="error-header">
            <span class="error-type">${error.type}</span>
            <span class="error-severity ${error.severity}">${error.severity}</span>
          </div>
          <div class="error-message">${error.message}</div>
          ${error.impact ? `<div class="error-impact">💡 Impacto: ${error.impact}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
  
  container.innerHTML = html;
}

function displayChanges(changes, data) {
  const container = document.getElementById('changes-tab');
  
  if (!changes || changes.length === 0) {
    showEmptyState('changes');
    return;
  }
  
  const html = `
    <div class="summary-card">
      <h3>📊 Resumen de Optimización</h3>
      <p>${data.summary}</p>
      <div class="summary-stats">
        <div class="stat">
          <div class="stat-value">${data.wcagLevel}</div>
          <div class="stat-label">Nivel WCAG</div>
        </div>
        <div class="stat">
          <div class="stat-value">${data.accessibilityScore}</div>
          <div class="stat-label">Score</div>
        </div>
        <div class="stat">
          <div class="stat-value">${changes.length}</div>
          <div class="stat-label">Cambios</div>
        </div>
      </div>
    </div>
    
    <div class="changes-list">
      ${changes.map(change => `
        <div class="change-item">
          <div class="change-category">${change.category}</div>
          <div class="change-description">${change.description}</div>
          <div class="change-reason">✅ ${change.reason}</div>
        </div>
      `).join('')}
    </div>
  `;
  
  container.innerHTML = html;
}

function displaySummary(data) {
  // Could add a summary notification or toast
  console.log('Optimización completada:', data);
}

function updatePreview() {
  const code = document.getElementById('optimized-code').value || 
                document.getElementById('original-code').value;
  
  const iframe = document.getElementById('preview-frame');
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  
  if (currentLanguage === 'html') {
    doc.open();
    doc.write(code);
    doc.close();
  } else if (currentLanguage === 'css') {
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>${code}</style>
      </head>
      <body>
        <h1>Título de Ejemplo</h1>
        <p>Párrafo de ejemplo con <a href="#">un enlace</a></p>
        <button>Botón de Ejemplo</button>
      </body>
      </html>
    `);
    doc.close();
  } else {
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <body>
        <h3>Preview no disponible para ${currentLanguage}</h3>
        <p>El código optimizado está en el editor de la izquierda.</p>
      </body>
      </html>
    `);
    doc.close();
  }
}

function copyOptimizedCode() {
  const code = document.getElementById('optimized-code').value;
  
  if (!code) {
    alert('No hay código optimizado para copiar');
    return;
  }
  
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('copy-btn');
    const originalText = btn.textContent;
    btn.textContent = '✅ Copiado!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  }).catch(err => {
    alert('Error al copiar: ' + err.message);
  });
}

function showEmptyState(tab) {
  const container = document.getElementById(`${tab}-tab`);
  const messages = {
    errors: '🔍 Haz click en "Optimizar con IA" para ver los errores detectados',
    changes: '📝 Los cambios realizados aparecerán aquí'
  };
  
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">${tab === 'errors' ? '🔍' : '📝'}</div>
      <p>${messages[tab]}</p>
    </div>
  `;
}

function showLoading(show) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !show);
}