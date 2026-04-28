const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const root = __dirname;
const dataPath = path.join(root, 'data', 'items.json');
const port = Number(process.env.PORT || 3000);
const categories = new Set(['documents', 'scripts', 'games']);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
  '.cs': 'text/plain; charset=utf-8',
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100 * 1024 * 1024) {
      throw new Error('File terlalu besar. Batas upload lokal: 100 MB.');
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function readItems() {
  try {
    const raw = await fs.readFile(dataPath, 'utf8');
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeItems(items) {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, `${JSON.stringify(items, null, 2)}\n`);
}

function safeFileName(name) {
  const cleaned = String(name || 'file')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${Date.now()}-${cleaned || 'file'}`;
}

function safeStaticPath(urlPath) {
  const cleanUrl = decodeURIComponent(urlPath.split('?')[0]);
  const requested = cleanUrl === '/' ? '/index.html' : cleanUrl;
  const filePath = path.normalize(path.join(root, requested));
  const relative = path.relative(root, filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? filePath : null;
}

async function handleUpload(req, res) {
  const body = await readJson(req);
  const category = String(body.category || '');

  if (!categories.has(category)) {
    send(res, 400, { error: 'Kategori tidak valid.' });
    return;
  }

  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const originalName = String(body.fileName || '').trim();
  const base64 = String(body.fileBase64 || '');

  if (!title || !description || !originalName || !base64) {
    send(res, 400, { error: 'Nama, deskripsi, dan file wajib diisi.' });
    return;
  }

  const fileName = safeFileName(originalName);
  const relativePath = `${category}/${fileName}`;
  const targetDir = path.join(root, category);
  const targetPath = path.join(targetDir, fileName);

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetPath, Buffer.from(base64, 'base64'));

  const scriptDetails = category === 'scripts'
    ? {
        engine: 'Unity',
        language: 'C#',
        module: String(body.module || '').trim(),
        tags: Array.isArray(body.tags) ? body.tags.filter(Boolean) : [],
      }
    : {};

  const item = {
    id: randomUUID(),
    category,
    title,
    description,
    meta: String(body.meta || '').trim() || [
      scriptDetails.engine,
      scriptDetails.language,
      scriptDetails.module,
    ].filter(Boolean).join(' / ') || category,
    ...scriptDetails,
    path: relativePath,
    originalName,
    createdAt: new Date().toISOString(),
  };

  const items = await readItems();
  items.unshift(item);
  await writeItems(items);

  send(res, 201, { item });
}

async function handleDelete(req, res) {
  const id = decodeURIComponent(req.url.split('/').pop().split('?')[0]);
  const items = await readItems();
  const item = items.find((entry) => entry.id === id);

  if (!item) {
    send(res, 404, { error: 'Berkas tidak ditemukan.' });
    return;
  }

  const filePath = path.normalize(path.join(root, item.path));
  const relative = path.relative(root, filePath);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    await fs.unlink(filePath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  await writeItems(items.filter((entry) => entry.id !== id));
  send(res, 200, { ok: true });
}

async function serveStatic(req, res) {
  const filePath = safeStaticPath(req.url);
  if (!filePath) {
    send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const type = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      send(res, 404, 'Not found', 'text/plain; charset=utf-8');
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url.startsWith('/api/items')) {
      send(res, 200, await readItems());
      return;
    }

    if (req.method === 'POST' && req.url.startsWith('/api/upload')) {
      await handleUpload(req, res);
      return;
    }

    if (req.method === 'DELETE' && req.url.startsWith('/api/items/')) {
      await handleDelete(req, res);
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      await serveStatic(req, res);
      return;
    }

    send(res, 405, { error: 'Method tidak didukung.' });
  } catch (error) {
    send(res, 500, { error: error.message || 'Server error.' });
  }
});

server.listen(port, () => {
  console.log(`Game Vault jalan di http://localhost:${port}`);
});
