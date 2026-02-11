const API_URL = 'http://localhost:3000';

let currentView = 'auth';

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const { authToken } = await chrome.storage.local.get(['authToken']);
  
  if (authToken) {
    await loadUserData();
  } else {
    showView('auth');
  }
  
  setupEventListeners();
}

function setupEventListeners() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', handleTabClick);
  });
  
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('register-form').addEventListener('submit', handleRegister);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('subscribe-btn').addEventListener('click', handleSubscribe);
  document.getElementById('back-to-dashboard').addEventListener('click', () => showView('dashboard'));
}

function handleTabClick(e) {
  const tab = e.target.dataset.tab;
  
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
  
  if (tab === 'login') {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
  } else {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
  }
  
  hideError();
}

async function handleLogin(e) {
  e.preventDefault();
  hideError();
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error al iniciar sesión');
    }
    
    await chrome.storage.local.set({
      authToken: data.token,
      userEmail: data.user.email,
      userRole: data.user.role
    });
    
    await loadUserData();
    notifyContentScript(data.user.role);
    
  } catch (error) {
    showError(error.message);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  hideError();
  
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error al registrarse');
    }
    
    await chrome.storage.local.set({
      authToken: data.token,
      userEmail: data.user.email,
      userRole: data.user.role
    });
    
    await loadUserData();
    notifyContentScript(data.user.role);
    
  } catch (error) {
    showError(error.message);
  }
}

async function handleLogout() {
  await chrome.storage.local.clear();
  showView('auth');
  notifyContentScript('free');
}

async function handleSubscribe() {
  try {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    
    const response = await fetch(`${API_URL}/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error al crear sesión de pago');
    }
    
    chrome.tabs.create({ url: data.url });
    
  } catch (error) {
    showError(error.message);
  }
}

async function loadUserData() {
  try {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) {
      throw new Error('Sesión expirada');
    }
    
    const data = await response.json();
    
    await chrome.storage.local.set({
      userEmail: data.user.email,
      userRole: data.user.role
    });
    
    document.getElementById('user-email').textContent = data.user.email;
    
    const planElement = document.getElementById('user-plan');
    if (data.user.role === 'premium') {
      planElement.textContent = 'Plan Premium ✨';
      planElement.classList.add('premium');
      document.querySelector('.plan-section').style.display = 'none';
      showView('premium');
    } else {
      planElement.textContent = 'Plan Gratuito';
      planElement.classList.remove('premium');
      showView('dashboard');
    }
    
  } catch (error) {
    await chrome.storage.local.clear();
    showView('auth');
  }
}

function showView(view) {
  currentView = view;
  
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('dashboard-view').classList.add('hidden');
  document.getElementById('premium-view').classList.add('hidden');
  
  if (view === 'auth') {
    document.getElementById('auth-view').classList.remove('hidden');
  } else if (view === 'dashboard') {
    document.getElementById('dashboard-view').classList.remove('hidden');
  } else if (view === 'premium') {
    document.getElementById('premium-view').classList.remove('hidden');
  }
}

function showError(message) {
  const errorEl = document.getElementById('error-message');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error-message').classList.add('hidden');
}

async function notifyContentScript(role) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'authUpdated',
      isPremium: role === 'premium'
    }).catch(() => {});
  }
}
