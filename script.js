const STORAGE_KEY = 'modelRelayPriceProviders:v4';
const API_URL = '/api/providers';
const OFFICIAL_PRICE = {
  inputPrice: 5,
  outputPrice: 30,
  cachePrice: 0.5,
};

const defaultProviders = [
  {
    id: crypto.randomUUID(),
    name: 'su8-max',
    rechargeCny: 12,
    usdCredit: 100,
    officialInputPrice: OFFICIAL_PRICE.inputPrice,
    officialOutputPrice: OFFICIAL_PRICE.outputPrice,
    officialCachePrice: OFFICIAL_PRICE.cachePrice,
    multiplier: 2,
  },
  {
    id: crypto.randomUUID(),
    name: 'woyao-0.3 Pro',
    rechargeCny: 100,
    usdCredit: 100,
    officialInputPrice: OFFICIAL_PRICE.inputPrice,
    officialOutputPrice: OFFICIAL_PRICE.outputPrice,
    officialCachePrice: OFFICIAL_PRICE.cachePrice,
    multiplier: 1,
  },
  {
    id: crypto.randomUUID(),
    name: 'TOK-Pro-0.4',
    rechargeCny: 100,
    usdCredit: 100,
    officialInputPrice: OFFICIAL_PRICE.inputPrice,
    officialOutputPrice: OFFICIAL_PRICE.outputPrice,
    officialCachePrice: OFFICIAL_PRICE.cachePrice,
    multiplier: 1,
  },
];

let providers = cloneDefaultProviders();
let forceShowOfficialPrices = false;
let saveTimer = null;
let importMode = 'merge';

const cardsEl = document.querySelector('#cards');
const rowsEl = document.querySelector('#priceRows');
const tableHeadRow = document.querySelector('#priceHeadRow');
const bestNameEl = document.querySelector('#bestName');
const bestOutputEl = document.querySelector('#bestOutput');
const bestGapEl = document.querySelector('#bestGap');
const restoreDefaultsBtn = document.querySelector('#restoreDefaultsBtn');
const exportDataBtn = document.querySelector('#exportDataBtn');
const importDataBtn = document.querySelector('#importDataBtn');
const importDataInput = document.querySelector('#importDataInput');
const providerForm = document.querySelector('#providerForm');
const formMessage = document.querySelector('#formMessage');
const officialToggleBtn = document.querySelector('#officialToggleBtn');
const officialVisibilityHint = document.querySelector('#officialVisibilityHint');

function loadProviders() {
  return cloneDefaultProviders();
}

async function loadProjectProviders() {
  const response = await fetch(API_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error('项目数据读取失败');
  const data = await response.json();
  const list = Array.isArray(data.providers) ? data.providers : [];
  return list.map(normalizeProvider).filter(Boolean);
}

function readLegacyBrowserProviders() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (Array.isArray(saved) && saved.length) {
      return saved.map(normalizeProvider).filter(Boolean);
    }
  } catch (error) {
    console.warn('读取浏览器旧数据失败。', error);
  }
  return [];
}

function providerSignature(list) {
  return JSON.stringify(list.map(item => ({
    name: item.name,
    rechargeCny: Number(item.rechargeCny),
    usdCredit: Number(item.usdCredit),
    officialInputPrice: Number(item.officialInputPrice),
    officialOutputPrice: Number(item.officialOutputPrice),
    officialCachePrice: Number(item.officialCachePrice),
    multiplier: Number(item.multiplier),
  })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')));
}

function cloneDefaultProviders() {
  return defaultProviders.map(provider => ({ ...provider, id: crypto.randomUUID() }));
}

function normalizeProvider(provider) {
  const name = String(provider?.name || '').trim();
  const rechargeCny = Number(provider?.rechargeCny);
  const usdCredit = Number(provider?.usdCredit);
  const officialInputPrice = Number(provider?.officialInputPrice ?? provider?.inputPrice ?? OFFICIAL_PRICE.inputPrice);
  const officialOutputPrice = Number(provider?.officialOutputPrice ?? provider?.outputPrice ?? OFFICIAL_PRICE.outputPrice);
  const officialCachePrice = Number(provider?.officialCachePrice ?? provider?.cachePrice ?? OFFICIAL_PRICE.cachePrice);
  const multiplier = Number(provider?.multiplier ?? 1);

  if (
    !name ||
    rechargeCny <= 0 ||
    usdCredit <= 0 ||
    officialInputPrice < 0 ||
    officialOutputPrice <= 0 ||
    officialCachePrice < 0 ||
    multiplier < 0
  ) return null;

  return {
    id: provider.id || crypto.randomUUID(),
    name,
    rechargeCny,
    usdCredit,
    officialInputPrice,
    officialOutputPrice,
    officialCachePrice,
    multiplier,
  };
}

async function persistProviders() {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providers }),
  });
  if (!response.ok) throw new Error('保存失败');
}

function saveProviders() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    try {
      await persistProviders();
    } catch (error) {
      console.error('项目数据保存失败。', error);
      showMessage('项目文件保存失败，请确认是通过启动器打开。');
    }
  }, 120);
}

async function initializeData() {
  try {
    const projectProviders = await loadProjectProviders();
    const legacyProviders = readLegacyBrowserProviders();
    const defaults = cloneDefaultProviders();
    const hasLegacyChanges = legacyProviders.length > 0 && providerSignature(legacyProviders) !== providerSignature(defaults);
    const projectLooksDefault = providerSignature(projectProviders) === providerSignature(defaults);

    providers = projectProviders.length ? projectProviders : defaults;

    if (hasLegacyChanges && projectLooksDefault && !localStorage.getItem('projectDataMigrated:v1')) {
      providers = legacyProviders;
      saveProviders();
      localStorage.setItem('projectDataMigrated:v1', 'true');
      showMessage('已把浏览器里的旧数据同步到项目文件。');
    }
  } catch (error) {
    console.warn('项目数据读取失败，临时使用浏览器数据。', error);
    const legacyProviders = readLegacyBrowserProviders();
    providers = legacyProviders.length ? legacyProviders : cloneDefaultProviders();
    showMessage('没有连上项目保存服务，本次修改可能只能临时保存在浏览器里。');
  }
  setFormDefaults();
  render();
}


function actualInputPrice(provider) {
  return provider.officialInputPrice * provider.multiplier;
}

function actualOutputPrice(provider) {
  return provider.officialOutputPrice * provider.multiplier;
}

function actualCachePrice(provider) {
  return provider.officialCachePrice * provider.multiplier;
}

function outputFor(provider, cny) {
  const outputPrice = actualOutputPrice(provider);
  if (outputPrice <= 0) return 0;
  return cny * (provider.usdCredit / provider.rechargeCny) / outputPrice;
}

function formatMillion(value) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(value);
}

function formatPrice(value) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 4 }).format(value);
}

function formatMoney(value, currency = '¥') {
  return `${currency}${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function getRechargeInput() {
  return document.querySelector('#rechargeInput');
}

function getTargetTokenSelect() {
  return document.querySelector('#targetTokenSelect');
}

function getRechargeAmount() {
  const input = getRechargeInput();
  const raw = Number(input?.value);
  if (!Number.isFinite(raw) || raw <= 0) return 10;
  return raw;
}

function getTargetTokenMillion() {
  const select = getTargetTokenSelect();
  const raw = Number(select?.value);
  if (!Number.isFinite(raw) || raw <= 0) return 100;
  return raw;
}

function costForOutput(provider, targetMillion) {
  const usdPerCny = provider.usdCredit / provider.rechargeCny;
  if (usdPerCny <= 0) return 0;
  return targetMillion * actualOutputPrice(provider) / usdPerCny;
}

function targetTokenLabel() {
  const select = getTargetTokenSelect();
  const option = select?.selectedOptions?.[0];
  return option ? option.textContent.replace(' tokens', '') : '1亿';
}

function targetOutputPriceLabel() {
  return `${targetTokenLabel()}输出价格`;
}

function isOfficialPriceSameForAll() {
  if (providers.length <= 1) return true;
  const first = providers[0];
  return providers.every(provider =>
    provider.officialInputPrice === first.officialInputPrice &&
    provider.officialOutputPrice === first.officialOutputPrice &&
    provider.officialCachePrice === first.officialCachePrice
  );
}

function shouldShowOfficialColumns() {
  return forceShowOfficialPrices || !isOfficialPriceSameForAll();
}

function rankedProviders(amount) {
  return providers
    .map(provider => ({
      ...provider,
      actualInputPrice: actualInputPrice(provider),
      actualOutputPrice: actualOutputPrice(provider),
      actualCachePrice: actualCachePrice(provider),
      outputForCurrent: outputFor(provider, amount),
      targetCostCny: costForOutput(provider, getTargetTokenMillion()),
      usdPerCny: provider.usdCredit / provider.rechargeCny,
    }))
    .sort((a, b) => b.outputForCurrent - a.outputForCurrent || a.name.localeCompare(b.name, 'zh-CN'));
}

function editableCell(provider, field, value, type = 'number', extra = '') {
  const safeValue = type === 'text' ? escapeHtml(value) : value;
  return `<input class="table-input" data-id="${provider.id}" data-field="${field}" type="${type}" value="${safeValue}" ${extra}>`;
}

function renderTableHead(showOfficial) {
  const currentAmount = getRechargeAmount();
  const currentTarget = getTargetTokenMillion();
  tableHeadRow.innerHTML = `
    <th>中转站</th>
    <th>充值</th>
    <th>到账</th>
    <th>倍率</th>
    ${showOfficial ? '<th>官方输入价</th><th>官方输出价</th><th>官方缓存价</th>' : ''}
    <th>实际输入价</th>
    <th>实际输出价</th>
    <th>实际缓存价</th>
    <th class="calculation-head output-condition-head">
      <div class="head-inline-control">
        <label for="rechargeInput">每</label>
        <div class="head-money-input">
          <span>¥</span>
          <input id="rechargeInput" type="number" min="1" step="1" value="${currentAmount}" inputmode="decimal" aria-label="按多少人民币计算输出" />
        </div>
        <span>输出</span>
      </div>
    </th>
    <th class="calculation-head target-condition-head">
      <div class="head-inline-control">
        <select id="targetTokenSelect" aria-label="选择目标输出量">
          <option value="1" ${currentTarget === 1 ? 'selected' : ''}>100万 tokens</option>
          <option value="10" ${currentTarget === 10 ? 'selected' : ''}>1000万 tokens</option>
          <option value="100" ${currentTarget === 100 ? 'selected' : ''}>1亿 tokens</option>
        </select>
        <span>输出价格</span>
      </div>
    </th>
    <th>操作</th>
  `;
}

function renderEmptyState() {
  const showOfficial = shouldShowOfficialColumns();
  renderTableHead(showOfficial);
  const columnCount = showOfficial ? 13 : 10;
  bestNameEl.textContent = '暂无渠道';
  bestOutputEl.textContent = '-';
  bestGapEl.textContent = '-';
  cardsEl.innerHTML = '<div class="empty-state">还没有渠道。先在上方添加一个，就能开始对比。</div>';
  rowsEl.innerHTML = `<tr><td colspan="${columnCount}" class="muted">暂无渠道，请先新增。</td></tr>`;
}

function renderOfficialControls(showOfficial, sameOfficialPrice) {
  if (!officialToggleBtn || !officialVisibilityHint) return;
  officialToggleBtn.textContent = showOfficial ? '隐藏官方价' : '显示官方价';
  officialToggleBtn.setAttribute('aria-pressed', String(showOfficial));
  const hintText = sameOfficialPrice
    ? '当前所有渠道官方价一致，表格默认只展示实际价格。需要修改官方价时，可点击“显示官方价”。'
    : '检测到不同渠道的官方价不一致，已自动展示官方价列。';
  officialVisibilityHint.textContent = '?';
  officialVisibilityHint.setAttribute('aria-label', hintText);
  officialVisibilityHint.setAttribute('title', hintText);
  officialVisibilityHint.dataset.tooltip = hintText;
  officialVisibilityHint.classList.toggle('is-warning', !sameOfficialPrice);
}

function render(options = {}) {
  const amount = getRechargeAmount();
  const sameOfficialPrice = isOfficialPriceSameForAll();
  const showOfficial = shouldShowOfficialColumns();
  renderOfficialControls(showOfficial, sameOfficialPrice);

  if (!providers.length) {
    renderEmptyState();
    return;
  }

  const ranked = rankedProviders(amount);
  const best = ranked[0];
  const second = ranked[1];
  const maxOutput = best.outputForCurrent || 1;
  bestNameEl.textContent = best.name;
  bestOutputEl.textContent = formatMillion(best.outputForCurrent);
  bestGapEl.textContent = second
    ? `${formatMillion(best.outputForCurrent / second.outputForCurrent)} 倍`
    : '只有 1 个渠道';

  cardsEl.innerHTML = ranked.map((provider, index) => {
    const width = Math.max(3, (provider.outputForCurrent / maxOutput) * 100);
    return `
      <article class="provider-card">
        <span class="rank">#${index + 1}</span>
        <h3>${escapeHtml(provider.name)}</h3>
        <p class="output-number"><span>${formatMillion(provider.outputForCurrent)}</span> M</p>
        <div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${width}%"></div></div>
        <div class="card-foot">
          <span>每 ${formatMoney(amount)}：${formatMillion(provider.outputForCurrent)}M</span>
          <span>倍率：${formatPrice(provider.multiplier)}</span>
        </div>
        <div class="price-chips" aria-label="实际价格明细">
          <span>实际输入 $${formatPrice(provider.actualInputPrice)}/M</span>
          <span>实际输出 $${formatPrice(provider.actualOutputPrice)}/M</span>
          <span>实际缓存 $${formatPrice(provider.actualCachePrice)}/M</span>
        </div>
      </article>`;
  }).join('');

  if (!options.preserveTableHead) {
    renderTableHead(showOfficial);
  }
  rowsEl.innerHTML = ranked.map(provider => `
    <tr>
      <td>${editableCell(provider, 'name', provider.name, 'text', 'aria-label="中转站名称"')}</td>
      <td>${editableCell(provider, 'rechargeCny', provider.rechargeCny, 'number', 'min="0.01" step="0.01" aria-label="充值金额"')}</td>
      <td>${editableCell(provider, 'usdCredit', provider.usdCredit, 'number', 'min="0.01" step="0.01" aria-label="到账美元"')}</td>
      <td>${editableCell(provider, 'multiplier', provider.multiplier, 'number', 'min="0" step="0.0001" aria-label="倍率"')}</td>
      ${showOfficial ? `
        <td>${editableCell(provider, 'officialInputPrice', provider.officialInputPrice, 'number', 'min="0" step="0.0001" aria-label="官方输入价"')}</td>
        <td>${editableCell(provider, 'officialOutputPrice', provider.officialOutputPrice, 'number', 'min="0.0001" step="0.0001" aria-label="官方输出价"')}</td>
        <td>${editableCell(provider, 'officialCachePrice', provider.officialCachePrice, 'number', 'min="0" step="0.0001" aria-label="官方缓存价"')}</td>
      ` : ''}
      <td class="muted actual-price">$${formatPrice(provider.actualInputPrice)}/M</td>
      <td class="muted actual-price">$${formatPrice(provider.actualOutputPrice)}/M</td>
      <td class="muted actual-price">$${formatPrice(provider.actualCachePrice)}/M</td>
      <td class="highlight">${formatMillion(provider.outputForCurrent)}M</td>
      <td class="highlight price-cost">${formatMoney(provider.targetCostCny)}</td>
      <td><button class="delete-btn" type="button" data-id="${provider.id}" aria-label="删除 ${escapeHtml(provider.name)}">删除</button></td>
    </tr>
  `).join('');
}

function showMessage(message) {
  formMessage.textContent = message;
  window.clearTimeout(showMessage.timer);
  showMessage.timer = window.setTimeout(() => {
    formMessage.textContent = '';
  }, 2600);
}

function updateProviderField(id, field, rawValue) {
  const provider = providers.find(item => item.id === id);
  if (!provider) return;

  if (field === 'name') {
    const nextName = String(rawValue).trim();
    if (!nextName) return;
    provider.name = nextName;
  } else {
    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue)) return;
    const mustBePositive = ['rechargeCny', 'usdCredit', 'officialOutputPrice'];
    if (mustBePositive.includes(field) && nextValue <= 0) return;
    if (!mustBePositive.includes(field) && nextValue < 0) return;
    provider[field] = nextValue;
  }

  saveProviders();
  render();
}

function buildExportPayload() {
  return {
    exportedAt: new Date().toISOString(),
    app: '中转站输出价格对比',
    version: 1,
    providers,
  };
}

function downloadTextFile(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportProviders() {
  const dateText = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const payload = buildExportPayload();
  downloadTextFile(`${dateText}-中转站价格数据.json`, JSON.stringify(payload, null, 2));
  showMessage('已导出数据文件。');
}

function parseImportedProviders(rawText) {
  const data = JSON.parse(rawText);
  const list = Array.isArray(data) ? data : data.providers;
  if (!Array.isArray(list)) throw new Error('没有找到渠道数据');
  const normalized = list.map(normalizeProvider).filter(Boolean);
  if (!normalized.length) throw new Error('没有有效渠道');
  return normalized;
}

function coreProviderData(provider) {
  return {
    name: String(provider.name || '').trim(),
    rechargeCny: Number(provider.rechargeCny),
    usdCredit: Number(provider.usdCredit),
    officialInputPrice: Number(provider.officialInputPrice),
    officialOutputPrice: Number(provider.officialOutputPrice),
    officialCachePrice: Number(provider.officialCachePrice),
    multiplier: Number(provider.multiplier),
  };
}

function providerDataKey(provider) {
  return JSON.stringify(coreProviderData(provider));
}

function providerValueKey(provider) {
  const data = coreProviderData(provider);
  delete data.name;
  return JSON.stringify(data);
}

function isImportedVersionName(name, baseName) {
  return name === `${baseName}（导入版）` || new RegExp(`^${escapeRegExp(baseName)}（导入版 \\d+）$`).test(name);
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasSameImportedVersion(baseName, importedProvider, providerList) {
  const valueKey = providerValueKey(importedProvider);
  return providerList.some(provider => (
    isImportedVersionName(provider.name, baseName) && providerValueKey(provider) === valueKey
  ));
}

function makeUniqueImportedName(baseName, usedNames) {
  const firstName = `${baseName}（导入版）`;
  if (!usedNames.has(firstName)) {
    usedNames.add(firstName);
    return firstName;
  }

  let index = 2;
  while (usedNames.has(`${baseName}（导入版 ${index}）`)) {
    index += 1;
  }
  const nextName = `${baseName}（导入版 ${index}）`;
  usedNames.add(nextName);
  return nextName;
}

function mergeImportedProviders(importedProviders) {
  const existingKeys = new Set(providers.map(providerDataKey));
  const usedNames = new Set(providers.map(provider => provider.name));
  const merged = [...providers];
  const stats = { added: 0, skipped: 0, renamed: 0 };

  importedProviders.forEach(importedProvider => {
    const importedKey = providerDataKey(importedProvider);
    if (existingKeys.has(importedKey)) {
      stats.skipped += 1;
      return;
    }

    const nextProvider = { ...importedProvider, id: crypto.randomUUID() };
    if (usedNames.has(nextProvider.name)) {
      if (hasSameImportedVersion(nextProvider.name, nextProvider, merged)) {
        existingKeys.add(importedKey);
        stats.skipped += 1;
        return;
      }
      nextProvider.name = makeUniqueImportedName(nextProvider.name, usedNames);
      stats.renamed += 1;
    } else {
      usedNames.add(nextProvider.name);
    }

    merged.push(nextProvider);
    existingKeys.add(importedKey);
    existingKeys.add(providerDataKey(nextProvider));
    stats.added += 1;
  });

  return { merged, stats };
}

async function replaceProvidersFromFile(file) {
  const rawText = await file.text();
  const importedProviders = parseImportedProviders(rawText);
  providers = importedProviders;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
  await persistProviders();
  forceShowOfficialPrices = false;
  render();
  showMessage(`已覆盖导入 ${providers.length} 个渠道，并保存到项目文件。`);
}

async function mergeProvidersFromFile(file) {
  const rawText = await file.text();
  const importedProviders = parseImportedProviders(rawText);
  const { merged, stats } = mergeImportedProviders(importedProviders);
  providers = merged;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
  await persistProviders();
  render();
  showMessage(`合并完成：新增 ${stats.added} 个，跳过重复 ${stats.skipped} 个，同名改名 ${stats.renamed} 个。`);
}

async function importProvidersFromFile(file, mode = 'replace') {
  if (mode === 'merge') {
    await mergeProvidersFromFile(file);
    return;
  }
  await replaceProvidersFromFile(file);
}

tableHeadRow.addEventListener('input', event => {
  if (event.target?.id !== 'rechargeInput') return;
  render({ preserveTableHead: true });
});

tableHeadRow.addEventListener('change', event => {
  if (event.target?.id !== 'targetTokenSelect') return;
  render({ preserveTableHead: true });
});

exportDataBtn.addEventListener('click', exportProviders);
importDataBtn.addEventListener('click', () => {
  importMode = 'merge';
  importDataInput.click();
});
importDataInput.addEventListener('change', async () => {
  const file = importDataInput.files?.[0];
  if (!file) return;
  try {
    await importProvidersFromFile(file, importMode);
  } catch (error) {
    console.error('导入失败。', error);
    showMessage('导入失败，请确认选择的是正确的数据 JSON 文件。');
  } finally {
    importDataInput.value = '';
  }
});

restoreDefaultsBtn.addEventListener('click', () => {
  providers = cloneDefaultProviders();
  forceShowOfficialPrices = false;
  saveProviders();
  render();
  showMessage('已恢复默认 3 个示例渠道。');
});

officialToggleBtn.addEventListener('click', () => {
  forceShowOfficialPrices = !forceShowOfficialPrices;
  render();
});

providerForm.addEventListener('submit', event => {
  event.preventDefault();
  const formData = new FormData(providerForm);
  const nextProvider = normalizeProvider({
    name: formData.get('providerName'),
    rechargeCny: formData.get('providerCny'),
    usdCredit: formData.get('providerUsd'),
    officialInputPrice: formData.get('providerOfficialInput'),
    officialOutputPrice: formData.get('providerOfficialOutput'),
    officialCachePrice: formData.get('providerOfficialCache'),
    multiplier: formData.get('providerMultiplier'),
  });

  if (!nextProvider) {
    showMessage('请把渠道名称、充值金额、美元额度、官方价格和倍率都填成有效数字。');
    return;
  }

  providers.push(nextProvider);
  saveProviders();
  providerForm.reset();
  setFormDefaults();
  render();
  showMessage(`已新增「${nextProvider.name}」。`);
});

rowsEl.addEventListener('click', event => {
  const button = event.target.closest('.delete-btn');
  if (!button) return;
  const provider = providers.find(item => item.id === button.dataset.id);
  providers = providers.filter(item => item.id !== button.dataset.id);
  saveProviders();
  render();
  showMessage(provider ? `已删除「${provider.name}」。` : '已删除渠道。');
});

rowsEl.addEventListener('change', event => {
  const input = event.target.closest('.table-input');
  if (!input) return;
  updateProviderField(input.dataset.id, input.dataset.field, input.value);
});

rowsEl.addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  const input = event.target.closest('.table-input');
  if (!input) return;
  event.preventDefault();
  input.blur();
});

function setFormDefaults() {
  document.querySelector('#providerOfficialInput').value = OFFICIAL_PRICE.inputPrice;
  document.querySelector('#providerOfficialOutput').value = OFFICIAL_PRICE.outputPrice;
  document.querySelector('#providerOfficialCache').value = OFFICIAL_PRICE.cachePrice;
  document.querySelector('#providerMultiplier').value = 1;
}

initializeData();
