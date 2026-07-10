const HISTORY_KEY = 'licensed-resource-search:history';
const MAX_HISTORY_ITEMS = 6;

const state = {
  resources: [],
  query: '',
  provider: 'all',
  category: 'all',
};

const elements = {
  form: document.querySelector('#search-form'),
  input: document.querySelector('#search-input'),
  providerFilters: document.querySelector('#provider-filters'),
  categorySelect: document.querySelector('#category-select'),
  resultList: document.querySelector('#result-list'),
  resultCount: document.querySelector('#result-count'),
  emptyState: document.querySelector('#empty-state'),
  loadError: document.querySelector('#load-error'),
  resetSearch: document.querySelector('#reset-search'),
  quickRow: document.querySelector('#quick-row'),
  historyList: document.querySelector('#history-list'),
  clearHistory: document.querySelector('#clear-history'),
  jumpDialog: document.querySelector('#jump-dialog'),
  destinationHost: document.querySelector('#destination-host'),
  confirmJump: document.querySelector('#confirm-jump'),
  promotionNote: document.querySelector('#promotion-note'),
};

const rightsLabels = {
  owned: '自有内容',
  authorized: '明确授权',
  open_licensed: '开放许可',
  public_domain: '公有领域',
};

const providerLabels = {
  quark: '夸克网盘',
  baidu: '百度网盘',
  general: '公开外链',
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('zh-CN');
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function readHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(history) ? history.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeHistory(query) {
  const normalized = query.trim();
  if (!normalized) return;
  const history = readHistory().filter((item) => item !== normalized);
  history.unshift(normalized);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)));
  renderHistory();
}

function renderHistory() {
  const history = readHistory();
  elements.quickRow.hidden = history.length === 0;
  elements.historyList.replaceChildren();

  for (const query of history) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = query;
    button.addEventListener('click', () => {
      elements.input.value = query;
      state.query = query;
      renderResults();
    });
    elements.historyList.append(button);
  }
}

function searchableText(resource) {
  return normalizeText(
    [
      resource.title,
      resource.description,
      resource.category,
      resource.sourceName,
      resource.licenseName,
      ...(Array.isArray(resource.tags) ? resource.tags : []),
    ].join(' '),
  );
}

function filteredResources() {
  const query = normalizeText(state.query);
  return state.resources.filter((resource) => {
    const matchesQuery = !query || searchableText(resource).includes(query);
    const matchesCategory = state.category === 'all' || resource.category === state.category;
    const matchesProvider =
      state.provider === 'all' || resource.links?.some((link) => link.provider === state.provider);
    return matchesQuery && matchesCategory && matchesProvider;
  });
}

function renderResource(resource) {
  const article = document.createElement('article');
  article.className = 'result-card';
  const tags = (resource.tags ?? [])
    .slice(0, 5)
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join('');

  article.innerHTML = `
    <div>
      <div class="result-meta">
        <span class="rights-badge">${escapeHtml(rightsLabels[resource.rightsStatus] ?? '授权已审核')}</span>
        <span>${escapeHtml(resource.category ?? '未分类')}</span>
        <span>来源：${escapeHtml(resource.sourceName ?? '公开来源')}</span>
        <span>许可：${escapeHtml(resource.licenseName ?? '授权凭据已审核')}</span>
      </div>
      <h3>${escapeHtml(resource.title)}</h3>
      <p>${escapeHtml(resource.description ?? '')}</p>
      <div class="result-tags">${tags}</div>
    </div>
    <div class="result-actions"></div>
  `;

  const actions = article.querySelector('.result-actions');
  for (const link of resource.links ?? []) {
    const safeUrl = safeExternalUrl(link.url);
    if (!safeUrl) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'resource-link';
    button.textContent = link.label || providerLabels[link.provider] || '打开链接';
    button.addEventListener('click', () => openJumpDialog(safeUrl, Boolean(link.promoted)));
    actions.append(button);
  }

  if (!actions.childElementCount) actions.remove();
  return article;
}

function renderResults() {
  const resources = filteredResources();
  elements.resultList.replaceChildren(...resources.map(renderResource));
  elements.resultCount.textContent = `共 ${resources.length} 条已审核资源`;
  elements.emptyState.hidden = resources.length !== 0;
  elements.resultList.hidden = resources.length === 0;
}

function renderCategories() {
  const categories = [
    ...new Set(state.resources.map((resource) => resource.category).filter(Boolean)),
  ].sort((left, right) => left.localeCompare(right, 'zh-CN'));

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    elements.categorySelect.append(option);
  }
}

function openJumpDialog(url, promoted) {
  elements.destinationHost.textContent = url.hostname;
  elements.confirmJump.href = url.href;
  elements.promotionNote.hidden = !promoted;
  elements.jumpDialog.showModal();
}

function resetSearch() {
  state.query = '';
  state.provider = 'all';
  state.category = 'all';
  elements.input.value = '';
  elements.categorySelect.value = 'all';
  for (const button of elements.providerFilters.querySelectorAll('button')) {
    button.classList.toggle('active', button.dataset.provider === 'all');
  }
  renderResults();
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  state.query = elements.input.value.trim();
  writeHistory(state.query);
  renderResults();
});

elements.input.addEventListener('input', () => {
  state.query = elements.input.value.trim();
  renderResults();
});

elements.providerFilters.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-provider]');
  if (!button) return;
  state.provider = button.dataset.provider;
  for (const item of elements.providerFilters.querySelectorAll('button')) {
    item.classList.toggle('active', item === button);
  }
  renderResults();
});

elements.categorySelect.addEventListener('change', () => {
  state.category = elements.categorySelect.value;
  renderResults();
});

elements.resetSearch.addEventListener('click', resetSearch);
elements.clearHistory.addEventListener('click', () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});
elements.confirmJump.addEventListener('click', () => elements.jumpDialog.close());

async function loadResources() {
  try {
    const response = await fetch('./data/resources.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Resource index returned ${response.status}`);
    const resources = await response.json();
    if (!Array.isArray(resources)) throw new Error('Resource index is not an array');
    state.resources = resources;
    renderCategories();
    renderResults();
  } catch (error) {
    console.error(error);
    elements.resultList.hidden = true;
    elements.emptyState.hidden = true;
    elements.loadError.hidden = false;
    elements.resultCount.textContent = '读取失败';
  }
}

renderHistory();
loadResources();
