async function updateItemsJsonWithRetry(owner, repo, branch, token, nextItems, title) {
  let attempts = 0;

  while (attempts < 3) {
    try {
      const dataFile = await getGithubFile(owner, repo, branch, 'data/items.json', token);

      await putGithubFile({
        owner,
        repo,
        branch,
        path: 'data/items.json',
        token,
        content: toBase64Text(JSON.stringify(nextItems, null, 2)),
        message: `Remove data for ${title}`,
        sha: dataFile && dataFile.sha,
      });

      return; // sukses
    } catch (err) {
      if (!String(err.message).includes('409')) throw err;

      attempts++;
      await new Promise(r => setTimeout(r, 500));
    }
  }

  throw new Error('Gagal update items.json setelah beberapa percobaan.');
}
