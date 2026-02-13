// Background Service Worker

let petActiveInTab = new Set();

chrome.runtime.onInstalled.addListener(() => {
  console.log('Code Pet installed');
});

// Cuando el usuario hace click en el icono de la extensión
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  
  // Verificar si la URL es válida
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return;
  }

  // Toggle: si ya está activo, quitar mascota; si no, mostrarla
  if (petActiveInTab.has(tab.id)) {
    // Quitar mascota
    chrome.tabs.sendMessage(tab.id, { action: 'removePet' });
    petActiveInTab.delete(tab.id);
    chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  } else {
    // Mostrar mascota y analizar
    chrome.tabs.sendMessage(tab.id, { action: 'showPet' }, (response) => {
      if (chrome.runtime.lastError) {
        // Si no hay content script, inyectarlo
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['three.min.js', 'content.js']
        }).then(() => {
          chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content.css']
          });
          
          // Esperar un poco y enviar mensaje de nuevo
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: 'showPet' });
          }, 500);
        });
      }
    });
    
    petActiveInTab.add(tab.id);
    chrome.action.setBadgeText({ tabId: tab.id, text: '✓' });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#6fb96f' });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openAuth') {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
  }
  
  if (message.action === 'petRemoved' && sender.tab) {
    petActiveInTab.delete(sender.tab.id);
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: '' });
  }
});

// Limpiar estado cuando se cierra una pestaña
chrome.tabs.onRemoved.addListener((tabId) => {
  petActiveInTab.delete(tabId);
});

// Limpiar estado cuando se navega a otra página
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && petActiveInTab.has(tabId)) {
    petActiveInTab.delete(tabId);
    chrome.action.setBadgeText({ tabId: tabId, text: '' });
  }
});
