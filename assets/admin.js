async function deleteGithubItem(item) {
  const owner = document.getElementById('owner').value.trim();
  const repo = document.getElementById('repo').value.trim();
  const branch = document.getElementById('branch').value.trim() || 'main';
  const token = document.getElementById('token').value.trim();

  if (!owner || !repo || !branch || !token) {
    throw new Error('Lengkapi owner, repo, branch, dan token GitHub.');
  }

  // ================= DELETE FILE =================
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

  // ================= UPDATE JSON =================
  setStatus('Update data/items.json...');

  // 🔥 ambil data awal
  let dataFile = await getGithubFile(owner, repo, branch, 'data/items.json', token);
  let items = dataFile ? JSON.parse(fromBase64Text(dataFile.content)) : [];

  const nextItems = items.filter((entry) => entry.id !== item.id);

  // 🔥 PENTING: ambil SHA terbaru lagi (biar ga 409)
  dataFile = await getGithubFile(owner, repo, branch, 'data/items.json', token);

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
