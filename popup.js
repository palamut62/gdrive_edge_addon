let authToken = null;
const FOLDER_NAME = "File Hub Uploads";

const SCOPES = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/userinfo.email"];

document.addEventListener('DOMContentLoaded', () => {
    localizeHtml(); // Fix for static HTML placeholders

    // Load Client ID
    chrome.storage.local.get(['customClientId'], (result) => {
        if (result.customClientId) {
            document.getElementById('client-id-input').value = result.customClientId;
        }
    });

    // Save Client ID
    document.getElementById('save-client-id-btn').addEventListener('click', () => {
        const id = document.getElementById('client-id-input').value.trim();
        if (id) {
            chrome.storage.local.set({ customClientId: id }, () => {
                showToast(chrome.i18n.getMessage("clientIdSaved"), "success");
            });
        }
    });

    // Populate Redirect URI
    const redirectUri = chrome.identity.getRedirectURL();
    const redirectInput = document.getElementById('redirect-uri-input');
    if (redirectInput) {
        redirectInput.value = redirectUri;
        // Copy functionality
        document.getElementById('copy-uri-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(redirectUri).then(() => {
                showToast(chrome.i18n.getMessage("copiedToClipboard"), "success");
            });
        });
    }

    checkAuth();

    // Settings Panel Controls
    const settingsPanel = document.getElementById('settings-panel');
    const helpPanel = document.getElementById('help-panel');

    // Settings Toggle
    document.getElementById('settings-btn').addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
        helpPanel.classList.add('hidden'); // Close help if open
    });
    document.getElementById('close-settings-btn').addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
    });
    document.getElementById('back-settings-btn').addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
    });

    // Help Toggle
    document.getElementById('help-btn').addEventListener('click', () => {
        helpPanel.classList.toggle('hidden');
        settingsPanel.classList.add('hidden'); // Close settings if open
    });
    document.getElementById('close-help-btn').addEventListener('click', () => {
        helpPanel.classList.add('hidden');
    });
    document.getElementById('back-help-btn').addEventListener('click', () => {
        helpPanel.classList.add('hidden');
    });
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('fileInput');

    dropZone.addEventListener('click', () => {
        if (!authToken) return; // Prevent click if disabled (though CSS handles visual)
        fileInput.click();
    });
    fileInput.addEventListener('change', (e) => handleUpload(e.target.files[0]));

    // ... existing drag/drop ...
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (authToken && e.dataTransfer.files.length > 0) {
            handleUpload(e.dataTransfer.files[0]);
        }
    });

    // Paste Support
    document.addEventListener('paste', (e) => {
        if (!authToken) return;
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file') {
                const blob = item.getAsFile();
                handleUpload(blob);
                break; // Upload only the first file for now
            }
        }
    });

    // Window Controls
    document.getElementById('close-btn').addEventListener('click', () => window.close());

    // Detach to Window (Yellow Button)
    document.getElementById('minimize-btn').addEventListener('click', () => {
        chrome.windows.create({
            url: "popup.html",
            type: "popup",
            width: 400,
            height: 600
        });
        window.close(); // Close the popover to avoid duplicates
    });



    // Auth Buttons
    document.getElementById('auth-btn').addEventListener('click', authenticate);
    document.getElementById('logout-btn').addEventListener('click', logout);
});

async function checkAuth() {
    const result = await chrome.storage.local.get(['authToken']);
    if (result.authToken) {
        authToken = result.authToken;
        // Validate token
        try {
            const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${authToken}`);
            if (response.ok) {
                updateUI(true);
                findOrCreateFolder();
            } else {
                console.log("Token expired/invalid");
                chrome.storage.local.remove(['authToken']);
                updateUI(false);
            }
        } catch (e) {
            updateUI(false);
        }
    } else {
        updateUI(false);
    }
}

async function authenticate() {
    // 1. Check Storage for Custom ID
    const local = await chrome.storage.local.get(['customClientId']);
    let clientId = local.customClientId;

    // 1.5 Fallback: Check Input Field (if user typed but didn't click save)
    if (!clientId) {
        const inputVal = document.getElementById('client-id-input').value.trim();
        if (inputVal) clientId = inputVal;
    }

    // 2. Check Manifest if no custom ID
    if (!clientId) {
        const manifest = chrome.runtime.getManifest();
        clientId = manifest.oauth2 ? manifest.oauth2.client_id : null;
    }

    // Fallback or Alert if ID is likely the placeholder
    if (!clientId || clientId.includes("CLIENT_ID_BURAYA")) {
        console.error("Client ID missing or placeholder:", clientId);
        showToast(chrome.i18n.getMessage("toastManifestMissing"), "error");
        return;
    }

    // Auto-save if we found a valid ID from input but it wasn't in storage
    if (clientId && !local.customClientId && !clientId.includes("CLIENT_ID_BURAYA")) {
        chrome.storage.local.set({ customClientId: clientId });
    }

    const redirectUri = chrome.identity.getRedirectURL();
    console.log("Redirect URI:", redirectUri);

    // Ensure scopes are encoded correctly
    const encodedScopes = encodeURIComponent(SCOPES.join(' '));
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodedScopes}`;

    try {
        chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        }, (redirectUrl) => {
            if (chrome.runtime.lastError || !redirectUrl) {
                console.error(chrome.runtime.lastError);
                showToast(chrome.i18n.getMessage("toastConnectionError") + (chrome.runtime.lastError ? chrome.runtime.lastError.message : "İptal edildi"), "error");
                return;
            }

            // Parse Token from URL
            const urlParams = new URLSearchParams(new URL(redirectUrl).hash.substring(1)); // hash starts with #
            const token = urlParams.get('access_token');

            if (token) {
                authToken = token;
                chrome.storage.local.set({ authToken: token });
                updateUI(true);
                findOrCreateFolder();
                showToast(chrome.i18n.getMessage("toastAuthSuccess"), "success");
            } else {
                showToast(chrome.i18n.getMessage("toastTokenMissing"), "error");
            }
        });
    } catch (e) {
        showToast(chrome.i18n.getMessage("toastAuthFailed") + e.message, "error");
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconClass = 'fa-info-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';
    if (type === 'success') iconClass = 'fa-check-circle';

    toast.innerHTML = `
        <i class="fas ${iconClass} toast-icon"></i>
        <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000); // 3 seconds visible
}

function updateUI(isAuthenticated) {
    const uploadArea = document.getElementById('drop-zone');
    const fileInput = document.getElementById('fileInput');
    const listEl = document.getElementById('file-list');
    const authBtn = document.getElementById('auth-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const authStatusText = document.getElementById('auth-status-text');
    const uploadText = document.getElementById('upload-text');

    if (isAuthenticated) {
        // Connected State
        uploadArea.classList.remove('disabled');
        fileInput.disabled = false;
        uploadText.textContent = chrome.i18n.getMessage("dragDropText");
        // Settings Panel
        authBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        authStatusText.textContent = chrome.i18n.getMessage("statusConnected");
        authStatusText.style.color = "#059669"; // Green
    } else {
        // Disconnected State
        uploadArea.classList.add('disabled');
        fileInput.disabled = true;
        uploadText.textContent = chrome.i18n.getMessage("loginToUpload");
        listEl.innerHTML = `<div class="empty-state">${chrome.i18n.getMessage("emptyStateLogin")}</div>`;
        // Settings Panel
        authBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        authStatusText.textContent = chrome.i18n.getMessage("statusDisconnected");
        authStatusText.style.color = "#DC2626"; // Red
        document.getElementById('auth-btn-text').textContent = chrome.i18n.getMessage("connectGoogle");
    }
}

function logout() {
    authToken = null;
    chrome.storage.local.remove(['authToken'], () => {
        updateUI(false);
    });
}

// 2. Klasör Bul/Oluştur
async function findOrCreateFolder() {
    const q = `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();

    if (data.files && data.files.length > 0) {
        chrome.storage.local.set({ folderId: data.files[0].id });
        listFiles(data.files[0].id);
    } else {
        createFolder();
    }
}

async function createFolder() {
    const meta = { name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" };
    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(meta)
    });
    const data = await res.json();
    chrome.storage.local.set({ folderId: data.id });
    listFiles(data.id);
}

// 3. Dosya Yükleme
// 3. Dosya Yükleme
async function handleUpload(file) {
    if (!file) return;

    // UI Updates
    document.querySelector('.upload-content').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');
    showToast(chrome.i18n.getMessage("toastUploading"), "info");

    try {
        // Ensure we have a valid folder ID
        let folderId;
        const result = await chrome.storage.local.get(['folderId']);

        if (result.folderId) {
            folderId = result.folderId;
        } else {
            // If checking fails, try to find/create it again
            await findOrCreateFolder();
            const newResult = await chrome.storage.local.get(['folderId']);
            folderId = newResult.folderId;
        }

        if (!folderId) {
            throw new Error(chrome.i18n.getMessage("errorFolderIdNotFound"));
        }

        const metadata = { name: file.name, parents: [folderId] };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: form
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error ? errorData.error.message : chrome.i18n.getMessage("uploadFailed"));
        }

        showToast(chrome.i18n.getMessage("toastUploaded"), "success");
        listFiles(folderId); // Refresh list immediately

    } catch (error) {
        console.error('Upload error:', error);
        showToast(chrome.i18n.getMessage("toastUploadError") + error.message, "error");
    } finally {
        document.querySelector('.upload-content').classList.remove('hidden');
        document.getElementById('loader').classList.add('hidden');
    }
}

// 4. Listeleme
async function listFiles(folderId) {
    const q = `'${folderId}' in parents and trashed=false`;
    const fields = "files(id, name, size, createdTime, webContentLink, webViewLink)";

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${fields}&orderBy=createdTime desc`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    renderList(data.files);
}

function renderList(files) {
    const listEl = document.getElementById('file-list');
    listEl.innerHTML = '';

    if (!files || files.length === 0) {
        listEl.innerHTML = `<div class="empty-state">${chrome.i18n.getMessage("emptyStateNoFiles")}</div>`;
        return;
    }

    files.forEach(file => {
        const sizeKB = (file.size / 1024).toFixed(1) + ' KB';
        // HTML Oluştur
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <div class="file-icon"><i class="fas fa-file"></i></div>
            <div class="file-info">
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="file-meta">${sizeKB}</div>
            </div>
            <div class="file-actions">
                <i class="fas fa-download action-btn" data-link="${file.webContentLink}"></i>
                <i class="fas fa-trash action-btn delete-btn" data-id="${file.id}"></i>
            </div>
        `;
        listEl.appendChild(item);
    });

    // Buton eventleri
    document.querySelectorAll('.fa-download').forEach(btn => {
        btn.addEventListener('click', (e) => window.open(e.target.dataset.link, '_blank'));
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteFile(e.target.dataset.id));
    });
}

// 5. Silme
async function deleteFile(fileId) {
    showConfirmModal(chrome.i18n.getMessage("confirmDelete"), async () => {
        try {
            await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            // Refresh list
            chrome.storage.local.get(['folderId'], (res) => listFiles(res.folderId));
        } catch (error) {
            console.error("Delete failed", error);
            showToast("Silme işlemi başarısız", "error");
        }
    });
}

// 7. Custom Modal Helper
function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    // Set content
    msgEl.textContent = message;
    modal.classList.remove('hidden');

    // Clean up old listeners to prevent multiple firings
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    // Add new listeners
    newConfirmBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (onConfirm) onConfirm();
    });

    newCancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // Close on outside click
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    };
}

// 6. Localization Helper
function localizeHtml() {
    // Localize Text Nodes and Attributes
    function traverse(element) {
        if (element.nodeType === 3) { // Text Node
            const text = element.nodeValue;
            const match = text.match(/__MSG_(\w+)__/);
            if (match && match[1]) {
                const msg = chrome.i18n.getMessage(match[1]);
                if (msg) element.nodeValue = msg;
            }
        } else if (element.nodeType === 1) { // Element Node
            // Check attributes (like title)
            Array.from(element.attributes).forEach(attr => {
                const match = attr.value.match(/__MSG_(\w+)__/);
                if (match && match[1]) {
                    const msg = chrome.i18n.getMessage(match[1]);
                    if (msg) attr.value = msg;
                }
            });

            // Recursively traverse children
            element.childNodes.forEach(traverse);
        }
    }

    traverse(document.body);
}
