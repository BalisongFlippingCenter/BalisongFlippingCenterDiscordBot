async function get(path, params = {}) {
  const url = new URL(`${process.env.BFC_API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`BFC API ${response.status} for ${path}`);
  return response.json();
}

module.exports = {
  searchKnives: search => get('/catalog/any/knives', { search }),
  getKnife: slug => get(`/catalog/any/knives/${encodeURIComponent(slug)}`),
  listMakers: () => get('/catalog/any/makers'),
  getMaker: slug => get(`/catalog/any/makers/${encodeURIComponent(slug)}`),
  siteUrl: path => `${process.env.BFC_SITE_URL}${path}`
};
