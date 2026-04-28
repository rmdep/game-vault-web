const lists = {
  documents: document.querySelector('[data-list="documents"]'),
  scripts: document.querySelector('[data-list="scripts"]'),
  games: document.querySelector('[data-list="games"]'),
};

const state = {
  documents: [],
  scripts: [],
  games: [],
};

const scriptViewer = document.getElementById('script-viewer');
const scriptViewerTitle = document.getElementById('script-viewer-title');
const scriptViewerCode = document.getElementById('script-viewer-code');
const scriptViewerCopy = document.getElementById('script-viewer-copy');
const scriptViewerClose = document.getElementById('script-viewer-close');
let activeScriptText = '';

function setCount(category, count) {
  const target = document.getElementById(`${category}-count`);
  target.textContent = `${count} file`;
}

function renderItem(item) {
  const article = document.createElement('article');
  article.className = 'card';

  const title = document.createElement('h3');
  title.textContent = item.title;

  const description = document.createElement('p');
  description.textContent = item.description;

  const badges = document.createElement('div');
  badges.className = 'badges';
  const badgeValues = item.category === 'scripts'
    ? [item.engine, item.language, item.module, ...(item.tags || [])]
    : [];
  badgeValues.filter(Boolean).forEach((value) => {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = value;
    badges.append(badge);
  });

  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = item.meta || item.category;

  const actions = document.createElement('div');
  actions.className = item.category === 'scripts' ? 'script-actions' : '';

  const link = document.createElement('a');
  link.className = 'download';
  link.href = item.path;
  link.download = '';
  link.textContent = 'Download';
  actions.append(link);

  if (item.category === 'scripts') {
    const open = document.createElement('button');
    open.className = 'download copy-script';
    open.type = 'button';
    open.textContent = 'Buka Script';
    open.addEventListener('click', () => openScript(item, open));
    actions.append(open);

    const copy = document.createElement('button');
    copy.className = 'download copy-script';
    copy.type = 'button';
    copy.textContent = 'Copy';
    copy.addEventListener('click', () => copyScript(item.path, copy));
    actions.append(copy);
  }

  const footer = document.createElement('div');
  footer.className = 'card-footer';

  footer.append(meta, actions);
  article.append(title, description);
  if (badges.children.length) article.append(badges);
  article.append(footer);
  return article;
}

async function openScript(item, button) {
  const original = button.textContent;
  try {
    button.textContent = 'Membuka...';
    const response = await fetch(item.path, { cache: 'no-store' });
    if (!response.ok) throw new Error('File tidak bisa dibaca');
    activeScriptText = await response.text();
    scriptViewerTitle.textContent = item.module || item.title;
    scriptViewerCode.textContent = activeScriptText;
    scriptViewer.hidden = false;
    scriptViewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    scriptViewerTitle.textContent = item.title;
    scriptViewerCode.textContent = error.message;
    scriptViewer.hidden = false;
  } finally {
    button.textContent = original;
  }
}

function renderEmpty(target) {
  const empty = document.createElement('p');
  empty.className = 'empty';
  empty.textContent = 'Tidak ada file yang cocok.';
  target.append(empty);
}

function renderCategory(category) {
  const target = lists[category];
  const search = document.querySelector(`[data-search="${category}"]`);
  const query = search.value.trim().toLowerCase();
  const filtered = state[category].filter((item) => {
    const text = [
      item.title,
      item.description,
      item.meta,
      item.originalName,
      item.engine,
      item.language,
      item.module,
      ...(item.tags || []),
    ].filter(Boolean).join(' ');
    return text.toLowerCase().includes(query);
  });

  target.innerHTML = '';
  setCount(category, state[category].length);
  if (!filtered.length) {
    renderEmpty(target);
    return;
  }
  filtered.forEach((item) => target.append(renderItem(item)));
}

async function copyScript(path, button) {
  const original = button.textContent;
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error('File tidak bisa dibaca');
    const text = await response.text();
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied';
    setTimeout(() => {
      button.textContent = original;
    }, 1300);
  } catch (error) {
    button.textContent = 'Gagal';
    setTimeout(() => {
      button.textContent = original;
    }, 1300);
  }
}

async function loadItems() {
  try {
    const isLocalMode = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const dataUrl = `data/items.json?v=${Date.now()}`;
    let response = isLocalMode
      ? await fetch('/api/items', { cache: 'no-store' })
      : await fetch(dataUrl, { cache: 'no-store' });

    if (!response.ok && isLocalMode) {
      response = await fetch(dataUrl, { cache: 'no-store' });
    }

    if (!response.ok) throw new Error('Tidak bisa membaca data item');
    const items = await response.json();

    Object.keys(lists).forEach((category) => {
      state[category] = items
        .filter((item) => item.category === category)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      renderCategory(category);
    });
  } catch (error) {
    Object.values(lists).forEach((target) => {
      target.innerHTML = `<p class="empty">${error.message}</p>`;
    });
  }
}

document.querySelectorAll('.folder-head').forEach((button) => {
  button.addEventListener('click', () => {
    const folder = button.closest('.category');
    const isClosed = folder.classList.toggle('is-closed');
    button.setAttribute('aria-expanded', String(!isClosed));
  });
});

document.querySelectorAll('[data-search]').forEach((input) => {
  input.addEventListener('input', () => renderCategory(input.dataset.search));
});

scriptViewerCopy.addEventListener('click', async () => {
  const original = scriptViewerCopy.textContent;
  try {
    await navigator.clipboard.writeText(activeScriptText);
    scriptViewerCopy.textContent = 'Copied';
  } catch (error) {
    scriptViewerCopy.textContent = 'Gagal';
  }
  setTimeout(() => {
    scriptViewerCopy.textContent = original;
  }, 1300);
});

scriptViewerClose.addEventListener('click', () => {
  scriptViewer.hidden = true;
  activeScriptText = '';
  scriptViewerCode.textContent = '';
});

loadItems();
