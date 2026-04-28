const form = document.getElementById('upload-form');
const statusBox = document.getElementById('status');
const categoryInput = document.getElementById('category');
const scriptFields = document.getElementById('script-fields');

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

    setStatus('Mengirim ke backend lokal...');
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        title,
        description,
        fileName: file.name,
        fileBase64: fileContent,
        module: scriptDetails.module || '',
        tags: scriptDetails.tags || [],
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Upload gagal.');

    form.reset();
    updateScriptFields();
    setStatus(`Selesai.\nFile: ${result.item.path}\nData sudah masuk ke data/items.json.`);
  } catch (error) {
    setStatus(`Gagal upload:\n${error.message}`);
  }
});
