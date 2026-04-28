const ADMIN_ID = 'admin';
const ADMIN_PASSWORD = 'gamevault123';
const loginPanel = document.getElementById('login-panel');
const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const adminContent = document.getElementById('admin-content');
const form = document.getElementById('upload-form');
const statusBox = document.getElementById('status');
const categoryInput = document.getElementById('category');
const scriptFields = document.getElementById('script-fields');
const githubSettings = document.getElementById('github-settings');
const uploadModeNote = document.getElementById('upload-mode-note');
const tokenInput = document.getElementById('token');
const clearTokenButton = document.getElementById('clear-token');
const adminFileList = document.getElementById('admin-file-list');
const githubFields = ['owner', 'repo', 'branch'];
const isLocalMode = ['localhost', '127.0.0.1'].includes(window.location.hostname);
let currentItems = [];

function showAdminContent() {
  loginPanel.hidden = true;
  adminContent.classList.remove('is-hidden');
  adminContent.hidden = false;
  loadAdminItems();
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const id = document.getElementById('admin-id').value.trim();
  const password = document.getElementById('admin-password').value;

  if (id === ADMIN_ID && password === ADMIN_PASSWORD) {
    loginStatus.textContent = '';
    showAdminContent();
    return;
  }

  loginStatus.textContent = 'ID atau password salah.';
});

if (!isLocalMode) {
  githubSettings.classList.remove('is-hidden');
  uploadModeNote.textContent = 'Upload dari GitHub Pages akan mengirim file dan data langsung ke repo GitHub.';
}

githubFields.forEach((field) => {
  const input = document.getElementById(field);
  input.value = localStorage.getItem(`vault-${field}`) || input.value;
  input.addEventListener('input', () => localStorage.setItem(`vault-${field}`, input.value));
});

tokenInput.value = localStorage.getItem('vault-token') || '';
tokenInput.addEventListener('input', () => {
  localStorage.setItem('vault-token', tokenInput.value);
});

clearTokenButton.addEventListener('click', () => {
  localStorage.removeItem('vault-token');
  tokenInput.value = '';
  setStatus('Token tersimpan sudah dihapus dari browser ini.');
});

function setStatus(message) {
  statusBox.textContent = message;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function toBase64Text(value) {
  return btoa(unescape(encodeURIComponent(value)));
}

function fromBase64Text(value) {
  return decodeURIComponent(escape(atob(value.replace(/\n/g, ''))));
}

function safeFileName(name) {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${Date.now()}-${cleaned || 'file'}`;
}

function apiUrl(owner, repo, path) {
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replaceAll('%2F', '/')}`;
}

async function githubRequest(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}\n${text}`);
  }

  return response.status === 204 ? null : response.json();
}

async function getGithubFile(owner, repo, branch, path, token) {
  try {
    return await githubRequest(`${apiUrl(owner, repo, path)}?ref=${encodeURIComponent(branch)}`, token);
  } catch (error) {
    if (String(error.message).startsWith('404')) return null;
    throw error;
  }
}

async function putGithubFile({ owner, repo, branch, path, token, content, message, sha }) {
  return githubRequest(apiUrl(owner, repo, path), token, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content,
      branch,
      sha,
    }),
  });
}

async function deleteGithubFile({ owner, repo, branch, path, token, sha, message }) {
  return githubRequest(apiUrl(owner, repo, path), token, {
    method: 'DELETE',
    body: JSON.stringify({
      message,
      branch,
      sha,
    }),
  });
}

function getScriptDetails() {
  const module = document.getElementById('script-module').value.trim();
  const tags = document.getElementById('script-tags').value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    engine: 'Unity',
    language: 'C#',
    module,
    tags,
  };
}

function updateScriptFields() {
  scriptFields.classList.toggle('is-hidden', categoryInput.value !== 'scripts');
}

categoryInput.addEventListener('change', updateScriptFields);
updateScriptFields();

async function uploadLocal(payload) {
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Upload gagal.');
  return result.item;
}

async function deleteLocalItem(id) {
  const response = await fetch(`/api/items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Hapus gagal.');
}

async function uploadGithub(payload, scriptDetails) {
  const owner = document.getElementById('owner').value.trim();
  const repo = document.getElementById('repo').value.trim();
  const branch = document.getElementById('branch').value.trim() || 'main';
  const token = document.getElementById('token').value.trim();

  if (!owner || !repo || !branch || !token) {
    throw new Error('Lengkapi owner, repo, branch, dan token GitHub.');
  }

  const filePath = `${payload.category}/${safeFileName(payload.fileName)}`;

  setStatus(`Upload file ke ${filePath}...`);
  await putGithubFile({
    owner,
    repo,
    branch,
    path: filePath,
    token,
    content: payload.fileBase64,
    message: `Upload ${payload.title}`,
  });

  setStatus('Update data/items.json...');
  const dataFile = await getGithubFile(owner, repo, branch, 'data/items.json', token);
  const items = dataFile ? JSON.parse(fromBase64Text(dataFile.content)) : [];
  const item = {
    id: crypto.randomUUID(),
    category: payload.category,
    title: payload.title,
    description: payload.description,
    meta: [
      scriptDetails.engine,
      scriptDetails.language,
      scriptDetails.module,
    ].filter(Boolean).join(' / ') || payload.category,
    ...scriptDetails,
    path: filePath,
    originalName: payload.fileName,
    createdAt: new Date().toISOString(),
  };

  items.unshift(item);
  await putGithubFile({
    owner,
    repo,
    branch,
    path: 'data/items.json',
    token,
    content: toBase64Text(JSON.stringify(items, null, 2)),
    message: `Add data for ${payload.title}`,
    sha: dataFile && dataFile.sha,
  });

  return item;
}

async function loadAdminItems() {
  try {
    adminFileList.innerHTML = '<p class="empty">Membaca daftar berkas...</p>';
    const response = await fetch(`data/items.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Tidak bisa membaca data/items.json');
    currentItems = await response.json();
    renderAdminItems();
  } catch (error) {
    adminFileList.innerHTML = `<p class="empty">${error.message}</p>`;
  }
}

function renderAdminItems() {
  adminFileList.innerHTML = '';

  if (!currentItems.length) {
    adminFileList.innerHTML = '<p class="empty">Belum ada berkas.</p>';
    return;
  }

  currentItems.forEach((item) => {
    const row = document.createElement('article');
    row.className = 'admin-file-row';

    const info = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = item.title;
    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = `${item.category} - ${item.originalName || item.path}`;
    info.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'script-actions';

    const open = document.createElement('a');
    open.className = 'download';
    open.href = item.path;
    open.target = '_blank';
    open.rel = 'noreferrer';
    open.textContent = 'Buka';

    const remove = document.createElement('button');
    remove.className = 'download danger';
    remove.type = 'button';
    remove.textContent = 'Hapus';
    remove.addEventListener('click', () => deleteItem(item, remove));

    actions.append(open, remove);
    row.append(info, actions);
    adminFileList.append(row);
  });
}

async function deleteGithubItem(item) {
  const owner = document.getElementById('owner').value.trim();
  const repo = document.getElementById('repo').value.trim();
  const branch = document.getElementById('branch').value.trim() || 'main';
  const token = document.getElementById('token').value.trim();

  if (!owner || !repo || !branch || !token) {
    throw new Error('Lengkapi owner, repo, branch, dan token GitHub.');
  }

  setStatus(`Menghapus file ${item.path}...`);
  const targetFile = await getGithubFile(owner, repo, branch, item.path, token);
  if (targetFile) {
    await deleteGithubFile({
      owner,
      repo,
      branch,
      path: item.path,
      token,
      sha: targetFile.sha,
      message: `Delete ${item.title}`,
    });
  }

  setStatus('Update data/items.json...');
  const dataFile = await getGithubFile(owner, repo, branch, 'data/items.json', token);
  const items = dataFile ? JSON.parse(fromBase64Text(dataFile.content)) : [];
  const nextItems = items.filter((entry) => entry.id !== item.id);

  await putGithubFile({
    owner,
    repo,
    branch,
    path: 'data/items.json',
    token,
    content: toBase64Text(JSON.stringify(nextItems, null, 2)),
    message: `Remove data for ${item.title}`,
    sha: dataFile && dataFile.sha,
  });
}

async function deleteItem(item, button) {
  const confirmed = window.confirm(`Hapus "${item.title}" dari vault?`);
  if (!confirmed) return;

  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Menghapus...';

  try {
    if (isLocalMode) {
      await deleteLocalItem(item.id);
    } else {
      await deleteGithubItem(item);
    }
    currentItems = currentItems.filter((entry) => entry.id !== item.id);
    renderAdminItems();
    setStatus(`Selesai hapus: ${item.title}`);
  } catch (error) {
    setStatus(`Gagal hapus:\n${error.message}`);
    button.disabled = false;
    button.textContent = original;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const category = document.getElementById('category').value;
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const file = document.getElementById('file').files[0];
  const scriptDetails = category === 'scripts' ? getScriptDetails() : {};

  if (!title || !description || !file) {
    setStatus('Lengkapi semua field yang wajib diisi.');
    return;
  }

  try {
    setStatus('Membaca file...');
    const fileContent = await readFileAsBase64(file);
    const payload = {
      category,
      title,
      description,
      fileName: file.name,
      fileBase64: fileContent,
      module: scriptDetails.module || '',
      tags: scriptDetails.tags || [],
    };

    setStatus(isLocalMode ? 'Mengirim ke backend lokal...' : 'Mengirim ke GitHub...');
    const item = isLocalMode
      ? await uploadLocal(payload)
      : await uploadGithub(payload, scriptDetails);

    form.reset();
    updateScriptFields();
    loadAdminItems();
    setStatus(`Selesai.\nFile: ${item.path}\nData sudah masuk ke data/items.json.`);
  } catch (error) {
    setStatus(`Gagal upload:\n${error.message}`);
  }
});
