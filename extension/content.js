// Content Script - Análisis automático de la página con mascota 3D

const API_URL = 'http://localhost:3000';

let petOverlay = null;
let analysisPanel = null;
let currentAnalysis = null;
let scene, camera, renderer, petMesh, eyes, mouth;
let animationId = null;
let isVisible = false;

let petX = window.innerWidth - 150;
let petY = window.innerHeight - 150;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Variables para seguimiento de mirada
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let eyePupils = [];

// Variables para transición de color
let currentColor = { r: 111/255, g: 185/255, b: 111/255 }; // Verde inicial
let targetColor = { r: 111/255, g: 185/255, b: 111/255 };
let particles = [];

// NO inicializar automáticamente, esperar mensaje del background
// Escuchar mensajes del background
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'showPet') {
    if (!isVisible) {
      init();
    }
  } else if (message.action === 'removePet') {
    removePet();
  } else if (message.action === 'reanalyze') {
    if (isVisible) {
      runLocalAnalysis();
    }
  } else if (message.action === 'authUpdated') {
    updatePremiumUI(message.isPremium);
  }
});

function init() {
  if (isVisible) return;
  
  createPetOverlay3D();
  createAnalysisPanel();
  runLocalAnalysis();
  
  chrome.storage.local.get(['authToken', 'userRole'], (data) => {
    if (data.authToken) {
      updatePremiumUI(data.userRole === 'premium');
    }
  });
  
  isVisible = true;
  showWelcomeMessage();
  
  // Iniciar seguimiento de cursor GLOBAL
  initMouseTracking();
}

function removePet() {
  if (!isVisible) return;
  
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  
  if (petOverlay) {
    petOverlay.remove();
    petOverlay = null;
  }
  
  if (analysisPanel) {
    analysisPanel.remove();
    analysisPanel = null;
  }
  
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('mousemove', trackCursor);
  
  isVisible = false;
  chrome.runtime.sendMessage({ action: 'petRemoved' });
}

function showWelcomeMessage() {
  const welcome = document.createElement('div');
  welcome.id = 'code-pet-welcome';
  welcome.innerHTML = `
    <div class="welcome-content">
      <div class="welcome-icon">🐾</div>
      <h3>Code Pet Activado</h3>
      <p>Analizando ${window.location.hostname}...</p>
    </div>
  `;
  
  welcome.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(111, 185, 111, 0.95);
    color: white;
    padding: 20px 30px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-align: center;
    backdrop-filter: blur(10px);
    animation: slideDown 0.5s ease;
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
    #code-pet-welcome .welcome-icon { font-size: 48px; margin-bottom: 10px; }
    #code-pet-welcome h3 { margin: 0 0 8px 0; font-size: 18px; font-weight: 600; }
    #code-pet-welcome p { margin: 0; font-size: 14px; opacity: 0.9; }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(welcome);
  
  setTimeout(() => {
    welcome.style.transition = 'all 0.5s ease';
    welcome.style.opacity = '0';
    welcome.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(() => welcome.remove(), 500);
  }, 3000);
}

function createPetOverlay3D() {
  petOverlay = document.createElement('div');
  petOverlay.id = 'code-pet-overlay';
  petOverlay.innerHTML = `
    <div class="pet-container">
      <canvas id="pet-canvas"></canvas>
      <div class="pet-tooltip" id="pet-tooltip">Analizando...</div>
    </div>
  `;
  
  petOverlay.style.left = `${petX}px`;
  petOverlay.style.top = `${petY}px`;
  
  petOverlay.addEventListener('mousedown', handleMouseDown);
  petOverlay.addEventListener('click', handlePetClick);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  
  document.body.appendChild(petOverlay);
  
  // Inicializar Three.js
  initThreeJS();
}

function handleMouseDown(e) {
  isDragging = true;
  dragOffsetX = e.clientX - petX;
  dragOffsetY = e.clientY - petY;
  petOverlay.style.cursor = 'grabbing';
  petOverlay.classList.add('moving');
  e.stopPropagation();
  e.preventDefault();
}

function handleMouseMove(e) {
  if (isDragging) {
    petX = e.clientX - dragOffsetX;
    petY = e.clientY - dragOffsetY;
    
    // Limitar a los bordes de la pantalla
    petX = Math.max(0, Math.min(window.innerWidth - 120, petX));
    petY = Math.max(0, Math.min(window.innerHeight - 120, petY));
    
    petOverlay.style.left = `${petX}px`;
    petOverlay.style.top = `${petY}px`;
  }
}

function handleMouseUp() {
  if (isDragging) {
    isDragging = false;
    petOverlay.style.cursor = 'grab';
    petOverlay.classList.remove('moving');
  }
}

function handlePetClick(e) {
  if (!isDragging) {
    togglePanel();
  }
}

// Actualizar posición al redimensionar ventana
window.addEventListener('resize', () => {
  petX = Math.min(petX, window.innerWidth - 120);
  petY = Math.min(petY, window.innerHeight - 120);
  petOverlay.style.left = `${petX}px`;
  petOverlay.style.top = `${petY}px`;
});

function initThreeJS() {
  const canvas = document.getElementById('pet-canvas');
  const container = canvas.parentElement;
  
  // Scene
  scene = new THREE.Scene();
  
  // Camera
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.z = 5;
  
  // Renderer
  renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    alpha: true,
    antialias: true 
  });
  renderer.setSize(120, 120);
  renderer.setPixelRatio(window.devicePixelRatio);
  
  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);
  
  // Create pet
  createPet3D();
  
  // Animation loop
  animate();
}

function createPet3D() {
  const petGroup = new THREE.Group();
  
  // Body (main sphere)
  const bodyGeometry = new THREE.SphereGeometry(1.2, 32, 32);
  const bodyMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x6fb96f,
    shininess: 30
  });
  petMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
  petGroup.add(petMesh);
  
  // Eyes
  eyes = new THREE.Group();
  
  // Left eye
  const leftEyeWhite = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 16),
    new THREE.MeshPhongMaterial({ color: 0xffffff })
  );
  leftEyeWhite.position.set(-0.35, 0.3, 0.9);
  
  const leftEyePupil = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 16),
    new THREE.MeshPhongMaterial({ color: 0x000000 })
  );
  leftEyePupil.position.set(-0.35, 0.3, 1.05);
  leftEyePupil.userData.isLeftPupil = true;
  leftEyePupil.userData.baseX = -0.35;
  leftEyePupil.userData.baseY = 0.3;
  leftEyePupil.userData.baseZ = 1.05;
  
  eyes.add(leftEyeWhite);
  eyes.add(leftEyePupil);
  eyePupils.push(leftEyePupil);
  
  // Right eye
  const rightEyeWhite = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 16),
    new THREE.MeshPhongMaterial({ color: 0xffffff })
  );
  rightEyeWhite.position.set(0.35, 0.3, 0.9);
  
  const rightEyePupil = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 16),
    new THREE.MeshPhongMaterial({ color: 0x000000 })
  );
  rightEyePupil.position.set(0.35, 0.3, 1.05);
  rightEyePupil.userData.isLeftPupil = false;
  rightEyePupil.userData.baseX = 0.35;
  rightEyePupil.userData.baseY = 0.3;
  rightEyePupil.userData.baseZ = 1.05;
  
  eyes.add(rightEyeWhite);
  eyes.add(rightEyePupil);
  eyePupils.push(rightEyePupil);
  
  petGroup.add(eyes);
  
  // Mouth (will change based on mood)
  mouth = new THREE.Group();
  createHappyMouth();
  petGroup.add(mouth);
  
  // Floating particles around pet
  createParticles(petGroup);
  
  scene.add(petGroup);
  
  // Store reference
  scene.userData.petGroup = petGroup;
}

function createParticles(petGroup) {
  const particleGeometry = new THREE.SphereGeometry(0.08, 8, 8);
  const particleMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x6fb96f,
    transparent: true,
    opacity: 0.6
  });
  
  const positions = [
    [-1.5, 1.5, 0],
    [1.5, 1.5, 0],
    [-1.5, -1.5, 0],
    [1.5, -1.5, 0]
  ];
  
  positions.forEach(pos => {
    const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
    particle.position.set(pos[0], pos[1], pos[2]);
    particle.userData.originalY = pos[1];
    particle.userData.floatOffset = Math.random() * Math.PI * 2;
    particle.userData.isParticle = true; // Marcar como partícula
    petGroup.add(particle);
    particles.push(particle); // Guardar referencia
  });
}

function createHappyMouth() {
  mouth.clear();
  
  const curve = new THREE.EllipseCurve(
    0, -0.4, // center
    0.4, 0.25, // radius X, Y
    Math.PI * 0.2, Math.PI * 0.8, // start, end angle
    false
  );
  
  const points = curve.getPoints(20);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ 
    color: 0x000000,
    linewidth: 3
  });
  
  const mouthLine = new THREE.Line(geometry, material);
  mouthLine.position.z = 1.1;
  mouth.add(mouthLine);
}

function createNeutralMouth() {
  mouth.clear();
  
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.3, -0.4, 1.1),
    new THREE.Vector3(0.3, -0.4, 1.1)
  ]);
  const material = new THREE.LineBasicMaterial({ 
    color: 0x000000,
    linewidth: 3
  });
  
  const mouthLine = new THREE.Line(geometry, material);
  mouth.add(mouthLine);
}

function createWorriedMouth() {
  mouth.clear();
  
  const curve = new THREE.EllipseCurve(
    0, -0.3,
    0.4, 0.25,
    Math.PI * 1.2, Math.PI * 1.8,
    false
  );
  
  const points = curve.getPoints(20);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ 
    color: 0x000000,
    linewidth: 3
  });
  
  const mouthLine = new THREE.Line(geometry, material);
  mouthLine.position.z = 1.1;
  mouth.add(mouthLine);
}

function createAlertMouth() {
  mouth.clear();
  
  const geometry = new THREE.CircleGeometry(0.2, 16);
  const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
  
  const mouthCircle = new THREE.Mesh(geometry, material);
  mouthCircle.position.set(0, -0.4, 1.1);
  mouth.add(mouthCircle);
}

// ============================================
// SEGUIMIENTO DE MIRADA GLOBAL
// ============================================
function initMouseTracking() {
  // Listener GLOBAL en document para capturar movimiento del cursor en toda la página
  document.addEventListener('mousemove', trackCursor, { passive: true, capture: true });
}

function trackCursor(e) {
  // Capturar posición del cursor en toda la ventana
  mouseX = e.clientX;
  mouseY = e.clientY;
}

function updateEyeTracking() {
  if (!petOverlay || eyePupils.length === 0) return;
  
  // Calcular centro del muñeco en la pantalla
  const petCenterX = petX + 60; // mitad del ancho (120/2)
  const petCenterY = petY + 60; // mitad del alto (120/2)
  
  // Vector hacia el cursor
  const deltaX = mouseX - petCenterX;
  const deltaY = mouseY - petCenterY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  // Normalizar y limitar movimiento
  const maxMovement = 0.08; // Máximo desplazamiento de la pupila
  const normalizedX = distance > 0 ? (deltaX / distance) * maxMovement : 0;
  const normalizedY = distance > 0 ? -(deltaY / distance) * maxMovement : 0; // Invertir Y
  
  // Actualizar cada pupila con suavizado
  eyePupils.forEach(pupil => {
    const targetX = pupil.userData.baseX + normalizedX;
    const targetY = pupil.userData.baseY + normalizedY;
    const targetZ = pupil.userData.baseZ;
    
    // Interpolación suave (lerp)
    const lerpFactor = 0.1;
    pupil.position.x += (targetX - pupil.position.x) * lerpFactor;
    pupil.position.y += (targetY - pupil.position.y) * lerpFactor;
    pupil.position.z = targetZ;
  });
}

// ============================================
// TRANSICIÓN GRADUAL DE COLOR
// ============================================
function updateColorTransition() {
  const lerpSpeed = 0.02; // Velocidad de transición (más bajo = más suave)
  
  // Interpolar color actual hacia color objetivo
  currentColor.r += (targetColor.r - currentColor.r) * lerpSpeed;
  currentColor.g += (targetColor.g - currentColor.g) * lerpSpeed;
  currentColor.b += (targetColor.b - currentColor.b) * lerpSpeed;
  
  // Aplicar color al cuerpo
  if (petMesh) {
    petMesh.material.color.setRGB(currentColor.r, currentColor.g, currentColor.b);
  }
  
  // Aplicar color a las partículas
  particles.forEach(particle => {
    particle.material.color.setRGB(currentColor.r, currentColor.g, currentColor.b);
  });
}

function setTargetColorFromScore(avgScore) {
  // Colores tipo semáforo (RGB normalizado 0-1)
  if (avgScore >= 80) {
    // Verde (semáforo)
    targetColor = { r: 0/255, g: 200/255, b: 0/255 }; 
  } else if (avgScore >= 60) {
    // Amarillo
    targetColor = { r: 255/255, g: 215/255, b: 0/255 };
  } else if (avgScore >= 40) {
    // Naranja
    targetColor = { r: 255/255, g: 140/255, b: 0/255 };
  } else {
    // Rojo
    targetColor = { r: 220/255, g: 0/255, b: 0/255 };
  }
}

function animate() {
  animationId = requestAnimationFrame(animate);
  
  const time = Date.now() * 0.001;
  const petGroup = scene.userData.petGroup;
  
  if (petGroup) {
    // Gentle rotation
    petGroup.rotation.y = Math.sin(time * 0.5) * 0.1;
    petGroup.rotation.x = Math.sin(time * 0.3) * 0.05;
    
    // Floating animation (solo para el modelo 3D, no para la posición en pantalla)
    petGroup.position.y = Math.sin(time * 2) * 0.1;
    
    // Animate particles
    petGroup.children.forEach(child => {
      if (child.userData.floatOffset !== undefined) {
        child.position.y = child.userData.originalY + 
          Math.sin(time * 2 + child.userData.floatOffset) * 0.15;
      }
    });
  }
  
  // Actualizar seguimiento de mirada (se ejecuta en cada frame)
  updateEyeTracking();
  
  // Actualizar transición de color
  updateColorTransition();
  
  renderer.render(scene, camera);
}

function updatePetMood(scores) {
  const avgScore = (scores.ux + scores.accessibility + scores.readability + scores.codeQuality) / 4;
  
  const petTooltip = document.getElementById('pet-tooltip');
  const petGroup = scene.userData.petGroup;
  
  if (!petGroup) return;
  
  // Establecer color objetivo basado en puntuación (transición gradual)
  setTargetColorFromScore(avgScore);
  
  // Actualizar boca según puntuación
  if (avgScore >= 80) {
    createHappyMouth();
    petTooltip.textContent = '¡Excelente! 😊';
  } else if (avgScore >= 60) {
    createNeutralMouth();
    petTooltip.textContent = 'Bien, pero mejorable 😐';
  } else if (avgScore >= 40) {
    createWorriedMouth();
    petTooltip.textContent = 'Necesita mejoras 😟';
  } else {
    createAlertMouth();
    petTooltip.textContent = '¡Atención! Muchos problemas 😰';
  }
}

function createAnalysisPanel() {
  analysisPanel = document.createElement('div');
  analysisPanel.id = 'code-pet-panel';
  analysisPanel.className = 'hidden';
  analysisPanel.innerHTML = `
    <div class="panel-header">
      <h3>Code Pet Analysis</h3>
      <button id="close-panel">✕</button>
    </div>
    <div class="panel-content">
      <div class="scores-grid" id="scores-grid">
        <div class="score-card">
          <div class="score-label">UX</div>
          <div class="score-value" id="score-ux">-</div>
        </div>
        <div class="score-card">
          <div class="score-label">Accesibilidad</div>
          <div class="score-value" id="score-a11y">-</div>
        </div>
        <div class="score-card">
          <div class="score-label">Legibilidad</div>
          <div class="score-value" id="score-read">-</div>
        </div>
        <div class="score-card">
          <div class="score-label">Código</div>
          <div class="score-value" id="score-code">-</div>
        </div>
      </div>
      
      <div class="issues-section">
        <h4>Problemas detectados</h4>
        <div id="issues-list"></div>
      </div>
      
      <div class="premium-section" id="premium-section">
        <button id="analyze-premium" class="premium-btn">
          ✨ Análisis Inteligente (Premium)
        </button>
        <div id="premium-results" class="hidden"></div>
      </div>
      
      <div class="auth-section" id="auth-section">
        <p>Inicia sesión para análisis premium con IA</p>
        <button id="open-auth" class="auth-btn">Iniciar Sesión</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(analysisPanel);
  
  document.getElementById('close-panel').addEventListener('click', togglePanel);
  document.getElementById('analyze-premium').addEventListener('click', runPremiumAnalysis);
  document.getElementById('open-auth').addEventListener('click', openAuthPopup);
}

function togglePanel() {
  analysisPanel.classList.toggle('hidden');
}

function runLocalAnalysis() {
  const html = document.documentElement.outerHTML;
  const analysis = analyzeLocally(html);
  currentAnalysis = analysis;
  
  displayResults(analysis);
  updatePetMood(analysis.scores);
}

function analyzeLocally(html) {
  const issues = [];
  const scores = {
    ux: 100,
    accessibility: 100,
    readability: 100,
    codeQuality: 100
  };
  
  // Accesibilidad: imágenes sin alt
  const imgsWithoutAlt = document.querySelectorAll('img:not([alt])');
  if (imgsWithoutAlt.length > 0) {
    issues.push({
      type: 'accessibility',
      severity: 'high',
      message: `${imgsWithoutAlt.length} imágenes sin atributo alt`,
      count: imgsWithoutAlt.length
    });
    scores.accessibility -= Math.min(30, imgsWithoutAlt.length * 5);
  }
  
  // Accesibilidad: contraste de colores
  const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button');
  let lowContrastCount = 0;
  
  elements.forEach(el => {
    const style = window.getComputedStyle(el);
    const color = style.color;
    const bgColor = style.backgroundColor;
    
    if (color && bgColor && !hasGoodContrast(color, bgColor)) {
      lowContrastCount++;
    }
  });
  
  if (lowContrastCount > 0) {
    issues.push({
      type: 'accessibility',
      severity: 'medium',
      message: `${lowContrastCount} elementos con posible bajo contraste`,
      count: lowContrastCount
    });
    scores.accessibility -= Math.min(20, lowContrastCount * 2);
  }
  
  // Jerarquía de títulos
  const h1Count = document.querySelectorAll('h1').length;
  
  if (h1Count === 0) {
    issues.push({
      type: 'accessibility',
      severity: 'high',
      message: 'No se encontró elemento H1'
    });
    scores.accessibility -= 15;
    scores.readability -= 10;
  } else if (h1Count > 1) {
    issues.push({
      type: 'accessibility',
      severity: 'medium',
      message: `Múltiples H1 encontrados (${h1Count})`
    });
    scores.accessibility -= 10;
  }
  
  // Tamaño de fuente
  const smallText = Array.from(elements).filter(el => {
    const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
    return fontSize < 12;
  });
  
  if (smallText.length > 0) {
    issues.push({
      type: 'readability',
      severity: 'medium',
      message: `${smallText.length} elementos con texto muy pequeño (<12px)`,
      count: smallText.length
    });
    scores.readability -= Math.min(20, smallText.length * 3);
  }
  
  // Análisis de código: console.log en producción
  const scripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent).join('\n');
  const consoleLogMatches = scripts.match(/console\.(log|warn|error|debug)/g);
  
  if (consoleLogMatches && consoleLogMatches.length > 0) {
    issues.push({
      type: 'codeQuality',
      severity: 'low',
      message: `${consoleLogMatches.length} llamadas a console en producción`,
      count: consoleLogMatches.length
    });
    scores.codeQuality -= Math.min(15, consoleLogMatches.length * 2);
  }
  
  // Inline styles
  const inlineStyles = document.querySelectorAll('[style]');
  if (inlineStyles.length > 10) {
    issues.push({
      type: 'codeQuality',
      severity: 'medium',
      message: `${inlineStyles.length} elementos con estilos inline`,
      count: inlineStyles.length
    });
    scores.codeQuality -= Math.min(25, inlineStyles.length);
    scores.ux -= 10;
  }
  
  // React: componentes sin key
  if (window.React || document.querySelector('[data-reactroot]')) {
    const reactWarnings = checkReactIssues();
    if (reactWarnings.length > 0) {
      issues.push(...reactWarnings);
      scores.codeQuality -= reactWarnings.length * 5;
    }
  }
  
  // UX: botones y links sin texto
  const emptyButtons = Array.from(document.querySelectorAll('button, a')).filter(el => {
    return !el.textContent.trim() && !el.getAttribute('aria-label');
  });
  
  if (emptyButtons.length > 0) {
    issues.push({
      type: 'ux',
      severity: 'high',
      message: `${emptyButtons.length} botones/links sin texto o aria-label`,
      count: emptyButtons.length
    });
    scores.ux -= Math.min(20, emptyButtons.length * 5);
    scores.accessibility -= 15;
  }
  
  Object.keys(scores).forEach(key => {
    scores[key] = Math.max(0, Math.min(100, scores[key]));
  });
  
  return { issues, scores };
}

function hasGoodContrast(color1, color2) {
  const rgb1 = parseRGB(color1);
  const rgb2 = parseRGB(color2);
  
  if (!rgb1 || !rgb2) return true;
  
  const l1 = getLuminance(rgb1);
  const l2 = getLuminance(rgb2);
  
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return ratio >= 4.5;
}

function parseRGB(color) {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return {
    r: parseInt(match[1]),
    g: parseInt(match[2]),
    b: parseInt(match[3])
  };
}

function getLuminance(rgb) {
  const rsRGB = rgb.r / 255;
  const gsRGB = rgb.g / 255;
  const bsRGB = rgb.b / 255;
  
  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function checkReactIssues() {
  const warnings = [];
  
  const lists = document.querySelectorAll('ul, ol');
  lists.forEach(list => {
    const items = list.children;
    if (items.length > 3) {
      let hasKeys = true;
      for (let item of items) {
        if (!item.getAttribute('data-key') && !item.key) {
          hasKeys = false;
          break;
        }
      }
      if (!hasKeys) {
        warnings.push({
          type: 'codeQuality',
          severity: 'medium',
          message: 'Posibles listas React sin keys'
        });
      }
    }
  });
  
  return warnings;
}

function displayResults(analysis) {
  document.getElementById('score-ux').textContent = Math.round(analysis.scores.ux);
  document.getElementById('score-a11y').textContent = Math.round(analysis.scores.accessibility);
  document.getElementById('score-read').textContent = Math.round(analysis.scores.readability);
  document.getElementById('score-code').textContent = Math.round(analysis.scores.codeQuality);
  
  const issuesList = document.getElementById('issues-list');
  issuesList.innerHTML = '';
  
  if (analysis.issues.length === 0) {
    issuesList.innerHTML = '<p class="no-issues">✨ ¡No se encontraron problemas!</p>';
  } else {
    analysis.issues.forEach(issue => {
      const issueEl = document.createElement('div');
      issueEl.className = `issue-item severity-${issue.severity}`;
      issueEl.innerHTML = `
        <span class="issue-icon">${getSeverityIcon(issue.severity)}</span>
        <span class="issue-text">${issue.message}</span>
      `;
      issuesList.appendChild(issueEl);
    });
  }
}

function getSeverityIcon(severity) {
  const icons = {
    high: '🔴',
    medium: '🟡',
    low: '🔵'
  };
  return icons[severity] || '⚪';
}

async function runPremiumAnalysis() {
  const btn = document.getElementById('analyze-premium');
  btn.disabled = true;
  btn.textContent = 'Analizando...';
  
  try {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    
    const response = await fetch(`${API_URL}/analyze-premium`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        url: window.location.href,
        html: document.documentElement.outerHTML.substring(0, 50000),
        localAnalysis: currentAnalysis
      })
    });
    
    if (!response.ok) {
      throw new Error('Error en análisis premium');
    }
    
    const data = await response.json();
    displayPremiumResults(data);
    
  } catch (error) {
    alert('Error: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Análisis Inteligente (Premium)';
  }
}

function displayPremiumResults(data) {
  const resultsDiv = document.getElementById('premium-results');
  resultsDiv.classList.remove('hidden');
  resultsDiv.innerHTML = `
    <div class="premium-content">
      <h4>💎 Análisis Inteligente</h4>
      <div class="ai-explanation">
        <h5>Explicación Detallada</h5>
        <p>${data.explanation || 'Sin explicación disponible'}</p>
      </div>
      <div class="ai-priorities">
        <h5>Prioridades</h5>
        <p>${data.priorities || 'Sin prioridades disponibles'}</p>
      </div>
      ${data.suggestions ? `
        <div class="ai-suggestions">
          <h5>Sugerencias</h5>
          <p>${data.suggestions}</p>
        </div>
      ` : ''}
    </div>
  `;
}

function updatePremiumUI(isPremium) {
  const premiumSection = document.getElementById('premium-section');
  const authSection = document.getElementById('auth-section');
  
  if (isPremium) {
    premiumSection.classList.remove('hidden');
    authSection.classList.add('hidden');
  } else {
    premiumSection.classList.add('hidden');
    authSection.classList.remove('hidden');
  }
}

function openAuthPopup() {
  chrome.runtime.sendMessage({ action: 'openAuth' });
}

// Cleanup
window.addEventListener('beforeunload', () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (renderer) {
    renderer.dispose();
  }
  document.removeEventListener('mousemove', trackCursor);
});