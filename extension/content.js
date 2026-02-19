// Content Script - Client for Backend SaaS
// MANTIENE TODO EL DISEÑO VISUAL Y LA MASCOTA 3D

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

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let eyePupils = [];

let currentColor = { r: 111/255, g: 185/255, b: 111/255 };
let targetColor = { r: 111/255, g: 185/255, b: 111/255 };
let particles = [];

// User state
let userPlan = 'free';
let authToken = null;

// ============================================
// INITIALIZATION
// ============================================

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'showPet') {
    if (!isVisible) init();
  } else if (message.action === 'removePet') {
    removePet();
  } else if (message.action === 'reanalyze') {
    if (isVisible) runLocalAnalysis();
  } else if (message.action === 'authUpdated') {
    updateAuthState(message.token, message.plan);
  }
});

async function init() {
  if (isVisible) return;
  
  // Load auth state
  await loadAuthState();
  
  createPetOverlay3D();
  createAnalysisPanel();
  runLocalAnalysis();
  
  isVisible = true;
  showWelcomeMessage();
  initMouseTracking();
}

async function loadAuthState() {
  const data = await chrome.storage.local.get(['authToken', 'userPlan']);
  authToken = data.authToken || null;
  userPlan = data.userPlan || 'free';
  
  console.log('Auth state loaded:', { plan: userPlan, hasToken: !!authToken });
}

function updateAuthState(token, plan) {
  authToken = token;
  userPlan = plan || 'free';
  updatePremiumUI();
}

// ============================================
// TODO EL CÓDIGO DE LA MASCOTA 3D SE MANTIENE IGUAL
// (createPetOverlay3D, initThreeJS, createPet3D, etc.)
// ============================================

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
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    background: rgba(111, 185, 111, 0.95); color: white;
    padding: 20px 30px; border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-align: center; backdrop-filter: blur(10px);
    animation: slideDown 0.5s ease;
  `;
  
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

window.addEventListener('resize', () => {
  petX = Math.min(petX, window.innerWidth - 120);
  petY = Math.min(petY, window.innerHeight - 120);
  petOverlay.style.left = `${petX}px`;
  petOverlay.style.top = `${petY}px`;
});

function initThreeJS() {
  const canvas = document.getElementById('pet-canvas');
  
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.z = 5;
  
  renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    alpha: true,
    antialias: true 
  });
  renderer.setSize(120, 120);
  renderer.setPixelRatio(window.devicePixelRatio);
  
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);
  
  createPet3D();
  animate();
}

function createPet3D() {
  const petGroup = new THREE.Group();
  
  const bodyGeometry = new THREE.SphereGeometry(1.2, 32, 32);
  const bodyMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x6fb96f,
    shininess: 30
  });
  petMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
  petGroup.add(petMesh);
  
  eyes = new THREE.Group();
  
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
  
  mouth = new THREE.Group();
  createHappyMouth();
  petGroup.add(mouth);
  
  createParticles(petGroup);
  
  scene.add(petGroup);
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
    particle.userData.isParticle = true;
    petGroup.add(particle);
    particles.push(particle);
  });
}

function createHappyMouth() {
  mouth.clear();
  
  const curve = new THREE.EllipseCurve(
    0, -0.4,
    0.4, 0.25,
    Math.PI * 0.2, Math.PI * 0.8,
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

function initMouseTracking() {
  document.addEventListener('mousemove', trackCursor, { passive: true, capture: true });
}

function trackCursor(e) {
  mouseX = e.clientX;
  mouseY = e.clientY;
}

function updateEyeTracking() {
  if (!petOverlay || eyePupils.length === 0) return;
  
  const petCenterX = petX + 60;
  const petCenterY = petY + 60;
  
  const deltaX = mouseX - petCenterX;
  const deltaY = mouseY - petCenterY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  const maxMovement = 0.08;
  const normalizedX = distance > 0 ? (deltaX / distance) * maxMovement : 0;
  const normalizedY = distance > 0 ? -(deltaY / distance) * maxMovement : 0;
  
  eyePupils.forEach(pupil => {
    const targetX = pupil.userData.baseX + normalizedX;
    const targetY = pupil.userData.baseY + normalizedY;
    const targetZ = pupil.userData.baseZ;
    
    const lerpFactor = 0.1;
    pupil.position.x += (targetX - pupil.position.x) * lerpFactor;
    pupil.position.y += (targetY - pupil.position.y) * lerpFactor;
    pupil.position.z = targetZ;
  });
}

function updateColorTransition() {
  const lerpSpeed = 0.02;
  
  currentColor.r += (targetColor.r - currentColor.r) * lerpSpeed;
  currentColor.g += (targetColor.g - currentColor.g) * lerpSpeed;
  currentColor.b += (targetColor.b - currentColor.b) * lerpSpeed;
  
  if (petMesh) {
    petMesh.material.color.setRGB(currentColor.r, currentColor.g, currentColor.b);
  }
  
  particles.forEach(particle => {
    particle.material.color.setRGB(currentColor.r, currentColor.g, currentColor.b);
  });
}

function setTargetColorFromScore(avgScore) {
  if (avgScore >= 80) {
    targetColor = { r: 0/255, g: 200/255, b: 0/255 }; 
  } else if (avgScore >= 60) {
    targetColor = { r: 255/255, g: 215/255, b: 0/255 };
  } else if (avgScore >= 40) {
    targetColor = { r: 255/255, g: 140/255, b: 0/255 };
  } else {
    targetColor = { r: 220/255, g: 0/255, b: 0/255 };
  }
}

function animate() {
  animationId = requestAnimationFrame(animate);
  
  const time = Date.now() * 0.001;
  const petGroup = scene.userData.petGroup;
  
  if (petGroup) {
    petGroup.rotation.y = Math.sin(time * 0.5) * 0.1;
    petGroup.rotation.x = Math.sin(time * 0.3) * 0.05;
    petGroup.position.y = Math.sin(time * 2) * 0.1;
    
    petGroup.children.forEach(child => {
      if (child.userData.floatOffset !== undefined) {
        child.position.y = child.userData.originalY + 
          Math.sin(time * 2 + child.userData.floatOffset) * 0.15;
      }
    });
  }
  
  updateEyeTracking();
  updateColorTransition();
  
  renderer.render(scene, camera);
}

function updatePetMood(scores) {
  const avgScore = (scores.ux + scores.accessibility + scores.readability + scores.codeQuality) / 4;
  
  const petTooltip = document.getElementById('pet-tooltip');
  const petGroup = scene.userData.petGroup;
  
  if (!petGroup) return;
  
  setTargetColorFromScore(avgScore);
  
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

// ============================================
// PANEL DE ANÁLISIS (DISEÑO MANTENIDO)
// ============================================

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
        <button id="open-editor" class="premium-btn" style="margin-bottom: 12px;">
          🎨 Abrir Editor PRO
        </button>
        <button id="analyze-premium" class="premium-btn">
          ✨ Análisis Inteligente PRO
        </button>
        <div id="premium-results" class="hidden"></div>
      </div>
      
      <div class="auth-section" id="auth-section">
        <p>Inicia sesión para análisis premium con IA</p>
        <button id="open-auth" class="auth-btn">Iniciar Sesión</button>
      </div>
      
      <div class="upgrade-section hidden" id="upgrade-section">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 12px 0; font-size: 14px;">🔒 Análisis con IA disponible en Plan PRO</p>
          <button id="upgrade-btn" class="premium-btn" style="background: white; color: #667eea;">
            Actualizar a PRO
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(analysisPanel);
  
  document.getElementById('close-panel').addEventListener('click', togglePanel);
  document.getElementById('analyze-premium').addEventListener('click', runPremiumAnalysis);
  document.getElementById('open-auth').addEventListener('click', openAuthPopup);
  document.getElementById('upgrade-btn')?.addEventListener('click', openUpgrade);
  document.getElementById('open-editor')?.addEventListener('click', openEditor);
  
  updatePremiumUI();
}

function togglePanel() {
  analysisPanel.classList.toggle('hidden');
}

// ============================================
// ANÁLISIS LOCAL (SIN CAMBIOS)
// ============================================

function runLocalAnalysis() {
  const html = document.documentElement.outerHTML;
  const analysis = analyzeLocally(html);
  currentAnalysis = analysis;
  
  displayResults(analysis);
  updatePetMood(analysis.scores);
  
  // Send to backend for history (if authenticated)
  if (authToken) {
    saveLocalAnalysisToBackend(analysis);
  }
}

async function saveLocalAnalysisToBackend(analysis) {
  try {
    await fetch(`${API_URL}/analysis/local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        url: window.location.href,
        localData: analysis
      })
    });
  } catch (error) {
    console.log('Could not save to backend:', error.message);
  }
}

function analyzeLocally(html) {
  const issues = [];
  const scores = {
    ux: 100,
    accessibility: 100,
    readability: 100,
    codeQuality: 100
  };
  
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

// ============================================
// ANÁLISIS PREMIUM CON IA - BACKEND
// ============================================

async function runPremiumAnalysis() {
  if (!authToken) {
    openAuthPopup();
    return;
  }
  
  if (userPlan !== 'pro') {
    showUpgradePrompt();
    return;
  }
  
  const btn = document.getElementById('analyze-premium');
  btn.disabled = true;
  btn.textContent = 'Analizando con IA...';
  
  try {
    const response = await fetch(`${API_URL}/analysis/ai`, {
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
    
    const data = await response.json();
    
    if (!response.ok) {
      if (data.code === 'LIMIT_REACHED') {
        showLimitReached(data);
      } else {
        throw new Error(data.error || 'Error en análisis premium');
      }
      return;
    }
    
    displayPremiumResults(data.ai);
    
  } catch (error) {
    alert('Error: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Análisis Inteligente PRO';
  }
}

function displayPremiumResults(aiData) {
  const resultsDiv = document.getElementById('premium-results');
  resultsDiv.classList.remove('hidden');
  
  const recommendations = aiData.recommendations || [];
  const quickWins = aiData.quickWins || [];
  
  resultsDiv.innerHTML = `
    <div class="premium-content">
      <h4>💎 Análisis con IA</h4>
      
      <div class="ai-summary" style="background: #f0f7ff; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
        <p style="margin: 0; color: #333; font-size: 13px;">${aiData.summary || 'Sin resumen disponible'}</p>
      </div>
      
      ${quickWins.length > 0 ? `
        <div class="ai-section">
          <h5 style="color: #6fb96f; margin-bottom: 8px;">⚡ Victorias Rápidas</h5>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
            ${quickWins.map(w => `<li style="margin-bottom: 4px;">${w}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${recommendations.length > 0 ? `
        <div class="ai-section">
          <h5 style="color: #667eea; margin-bottom: 8px;">📋 Recomendaciones</h5>
          ${recommendations.slice(0, 5).map(rec => `
            <div style="background: white; padding: 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid ${getImpactColor(rec.impact)};">
              <strong style="font-size: 13px;">${rec.title}</strong>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${rec.description}</p>
              <div style="margin-top: 6px; font-size: 11px; color: #999;">
                Impacto: ${rec.impact} | Esfuerzo: ${rec.effort}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function getImpactColor(impact) {
  const colors = {
    high: '#e74c3c',
    medium: '#f39c12',
    low: '#3498db'
  };
  return colors[impact] || '#95a5a6';
}

function showLimitReached(data) {
  const resultsDiv = document.getElementById('premium-results');
  resultsDiv.classList.remove('hidden');
  resultsDiv.innerHTML = `
    <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 16px; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #856404;">⚠️ Límite Alcanzado</p>
      <p style="margin: 0; font-size: 13px; color: #856404;">
        Has usado ${data.used} de ${data.limit} análisis este mes.<br>
        Se resetea el: ${new Date(data.resetDate).toLocaleDateString()}
      </p>
    </div>
  `;
}

function showUpgradePrompt() {
  const resultsDiv = document.getElementById('premium-results');
  resultsDiv.classList.remove('hidden');
  resultsDiv.innerHTML = `
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center;">
      <h4 style="margin: 0 0 12px 0;">🔒 Análisis con IA</h4>
      <p style="margin: 0 0 16px 0; font-size: 14px;">
        Actualiza a Plan PRO para acceder a análisis inteligentes con IA
      </p>
      <button onclick="openUpgrade()" style="
        background: white;
        color: #667eea;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
      ">
        Actualizar a PRO - $9.99/mes
      </button>
    </div>
  `;
}

function updatePremiumUI() {
  const premiumSection = document.getElementById('premium-section');
  const authSection = document.getElementById('auth-section');
  const upgradeSection = document.getElementById('upgrade-section');
  
  if (!authToken) {
    // Not logged in
    premiumSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    upgradeSection.classList.add('hidden');
  } else if (userPlan === 'pro') {
    // PRO user
    premiumSection.classList.remove('hidden');
    authSection.classList.add('hidden');
    upgradeSection.classList.add('hidden');
  } else {
    // FREE user
    premiumSection.classList.add('hidden');
    authSection.classList.add('hidden');
    upgradeSection.classList.remove('hidden');
  }
}

function openAuthPopup() {
  chrome.runtime.sendMessage({ action: 'openAuth' });
}

async function openUpgrade() {
  if (!authToken) {
    openAuthPopup();
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/stripe/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    
    if (data.url) {
      window.open(data.url, '_blank');
    }
  } catch (error) {
    alert('Error al crear sesión de pago: ' + error.message);
  }
}

function openEditor() {
  chrome.runtime.sendMessage({ action: 'openEditor' });
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