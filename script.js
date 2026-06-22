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
    pricingMode: 'usd',
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
    pricingMode: 'usd',
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
    pricingMode: 'usd',
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
const providerPricingMode = document.querySelector('#providerPricingMode');
const providerCreditLabel = document.querySelector('#providerCreditLabel');
const providerInputPriceLabel = document.querySelector('#providerInputPriceLabel');
const providerOutputPriceLabel = document.querySelector('#providerOutputPriceLabel');
const providerCachePriceLabel = document.querySelector('#providerCachePriceLabel');
const providerMultiplierLabel = document.querySelector('#providerMultiplierLabel');
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
    pricingMode: item.pricingMode || 'usd',
    name: item.name,
    rechargeCny: Number(item.rechargeCny),
    usdCredit: Number(item.usdCredit || 0),
    cnyCredit: Number(item.cnyCredit || 0),
    officialInputPrice: Number(item.officialInputPrice || 0),
    officialOutputPrice: Number(item.officialOutputPrice || 0),
    officialCachePrice: Number(item.officialCachePrice || 0),
    cnyInputPrice: Number(item.cnyInputPrice || 0),
    cnyOutputPrice: Number(item.cnyOutputPrice || 0),
    cnyCachePrice: Number(item.cnyCachePrice || 0),
    multiplier: Number(item.multiplier || 0),
  })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')));
}

function cloneDefaultProviders() {
  return defaultProviders.map(provider => ({ ...provider, id: crypto.randomUUID() }));
}

function providerMode(provider) {
  return provider?.pricingMode === 'cny' ? 'cny' : 'usd';
}

function normalizeProvider(provider) {
  const pricingMode = providerMode(provider);
  const name = String(provider?.name || '').trim();
  const rechargeCny = Number(provider?.rechargeCny);

  if (!name || rechargeCny <= 0) return null;

  if (pricingMode === 'cny') {
    const cnyCredit = Number(provider?.cnyCredit ?? provider?.usdCredit ?? provider?.creditAmount ?? rechargeCny);
    const cnyInputPrice = Number(provider?.cnyInputPrice ?? provider?.officialInputPrice ?? provider?.inputPrice ?? 0);
    const cnyOutputPrice = Number(provider?.cnyOutputPrice ?? provider?.officialOutputPrice ?? provider?.outputPrice);
    const cnyCachePrice = Number(provider?.cnyCachePrice ?? provider?.officialCachePrice ?? provider?.cachePrice ?? 0);

    if (cnyCredit <= 0 || cnyInputPrice < 0 || cnyOutputPrice <= 0 || cnyCachePrice < 0) return null;

    return {
      id: provider.id || crypto.randomUUID(),
      pricingMode,
      name,
      rechargeCny,
      cnyCredit,
      cnyInputPrice,
      cnyOutputPrice,
      cnyCachePrice,
      multiplier: 1,
    };
  }

  const usdCredit = Number(provider?.usdCredit);
  const officialInputPrice = Number(provider?.officialInputPrice ?? provider?.inputPrice ?? OFFICIAL_PRICE.inputPrice);
  const officialOutputPrice = Number(provider?.officialOutputPrice ?? provider?.outputPrice ?? OFFICIAL_PRICE.outputPrice);
  const officialCachePrice = Number(provider?.officialCachePrice ?? provider?.cachePrice ?? OFFICIAL_PRICE.cachePrice);
  const multiplier = Number(provider?.multiplier ?? 1);

  if (
    usdCredit <= 0 ||
    officialInputPrice < 0 ||
    officialOutputPrice <= 0 ||
    officialCachePrice < 0 ||
    multiplier < 0
  ) return null;

  return {
    id: provider.id || crypto.randomUUID(),
    pricingMode,
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


function creditAmount(provider) {
  return providerMode(provider) === 'cny' ? provider.cnyCredit : provider.usdCredit;
}

function creditCurrency(provider) {
  return providerMode(provider) === 'cny' ? '¥' : '$';
}

function originalInputPrice(provider) {
  return providerMode(provider) === 'cny' ? provider.cnyInputPrice : provider.officialInputPrice * provider.multiplier;
}

function originalOutputPrice(provider) {
  return providerMode(provider) === 'cny' ? provider.cnyOutputPrice : provider.officialOutputPrice * provider.multiplier;
}

function originalCachePrice(provider) {
  return providerMode(provider) === 'cny' ? provider.cnyCachePrice : provider.officialCachePrice * provider.multiplier;
}

function cnyPerCreditUnit(provider) {
  const credit = creditAmount(provider);
  if (credit <= 0) return 0;
  return provider.rechargeCny / credit;
}

function actualInputPrice(provider) {
  return originalInputPrice(provider) * cnyPerCreditUnit(provider);
}

function actualOutputPrice(provider) {
  return originalOutputPrice(provider) * cnyPerCreditUnit(provider);
}

function actualCachePrice(provider) {
  return originalCachePrice(provider) * cnyPerCreditUnit(provider);
}

function outputFor(provider, cny) {
  const outputPrice = actualOutputPrice(provider);
  if (outputPrice <= 0) return 0;
  return cny / outputPrice;
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


function modeLabel(provider) {
  return providerMode(provider) === 'cny' ? '人民币直扣' : '美元额度';
}

function formatUnitPrice(value, currency = '¥') {
  return `${currency}${formatPrice(value)}/M`;
}

function creditField(provider) {
  return providerMode(provider) === 'cny' ? 'cnyCredit' : 'usdCredit';
}

function originalPriceField(provider, kind) {
  if (providerMode(provider) === 'cny') {
    return { input: 'cnyInputPrice', output: 'cnyOutputPrice', cache: 'cnyCachePrice' }[kind];
  }
  return { input: 'officialInputPrice', output: 'officialOutputPrice', cache: 'officialCachePrice' }[kind];
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
  return targetMillion * actualOutputPrice(provider);
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
  return forceShowOfficialPrices;
}

function rankedProviders(amount) {
  return providers
    .map(provider => ({
      ...provider,
      originalInputPrice: originalInputPrice(provider),
      originalOutputPrice: originalOutputPrice(provider),
      originalCachePrice: originalCachePrice(provider),
      actualInputPrice: actualInputPrice(provider),
      actualOutputPrice: actualOutputPrice(provider),
      actualCachePrice: actualCachePrice(provider),
      outputForCurrent: outputFor(provider, amount),
      targetCostCny: costForOutput(provider, getTargetTokenMillion()),
    }))
    .sort((a, b) => b.outputForCurrent - a.outputForCurrent || a.name.localeCompare(b.name, 'zh-CN'));
}

function editableCell(provider, field, value, type = 'number', extra = '') {
  const safeValue = type === 'text' ? escapeHtml(value) : value;
  return `<input class="table-input" data-id="${provider.id}" data-field="${field}" type="${type}" value="${safeValue}" ${extra}>`;
}

function prefixedEditableCell(provider, field, value, prefix, extra = '') {
  return `<div class="prefixed-input"><span>${prefix}</span>${editableCell(provider, field, value, 'number', extra)}</div>`;
}

function renderTableHead(showOfficial) {
  const currentAmount = getRechargeAmount();
  const currentTarget = getTargetTokenMillion();
  tableHeadRow.dataset.officialVisible = String(showOfficial);
  tableHeadRow.innerHTML = `
    <th>中转站</th>
    <th>计价方式</th>
    <th>充值 ¥</th>
    <th>到账</th>
    <th>渠道倍率</th>
    ${showOfficial ? '<th class="official-price-head">原始输入</th><th class="official-price-head">原始输出</th><th class="official-price-head">原始缓存</th>' : ''}
    <th>折算输入</th>
    <th>折算输出</th>
    <th>折算缓存</th>
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
  const columnCount = showOfficial ? 14 : 11;
  bestNameEl.textContent = '暂无渠道';
  bestOutputEl.textContent = '-';
  bestGapEl.textContent = '-';
  cardsEl.innerHTML = '<div class="empty-state">还没有渠道。先在上方添加一个，就能开始对比。</div>';
  rowsEl.innerHTML = `<tr><td colspan="${columnCount}" class="muted">暂无渠道，请先新增。</td></tr>`;
}

function renderOfficialControls(showOfficial, sameOfficialPrice) {
  if (!officialToggleBtn || !officialVisibilityHint) return;
  officialToggleBtn.textContent = showOfficial ? '隐藏原始价' : '显示原始价';
  officialToggleBtn.setAttribute('aria-pressed', String(showOfficial));
  const hintText = sameOfficialPrice
    ? '表格默认展示统一折算后的人民币成本。需要查看或修改原始单价时，可点击“显示原始价”。'
    : '不同渠道可能使用美元额度或人民币直扣，表格会统一折算成人民币成本做横向比较。';
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
          <span>${modeLabel(provider)}</span>
        </div>
        <div class="price-chips" aria-label="实际价格明细">
          <span>折算输入 ${formatUnitPrice(provider.actualInputPrice, '¥')}</span>
          <span>折算输出 ${formatUnitPrice(provider.actualOutputPrice, '¥')}</span>
          <span>折算缓存 ${formatUnitPrice(provider.actualCachePrice, '¥')}</span>
        </div>
      </article>`;
  }).join('');

  if (!options.preserveTableHead) {
    renderTableHead(showOfficial);
  }
  rowsEl.innerHTML = ranked.map(provider => {
    const isCnyMode = providerMode(provider) === 'cny';
    const originalCurrency = creditCurrency(provider);
    return `
    <tr>
      <td>${editableCell(provider, 'name', provider.name, 'text', 'aria-label="中转站名称"')}</td>
      <td><span class="mode-pill ${isCnyMode ? 'mode-cny' : 'mode-usd'}">${modeLabel(provider)}</span></td>
      <td>${editableCell(provider, 'rechargeCny', provider.rechargeCny, 'number', 'min="0.01" step="0.01" aria-label="充值金额"')}</td>
      <td>${prefixedEditableCell(provider, creditField(provider), creditAmount(provider), creditCurrency(provider), `min="0.01" step="0.01" aria-label="到账${isCnyMode ? '人民币' : '美元'}"`)}</td>
      <td>${isCnyMode ? '<span class="muted muted-dash">-</span>' : editableCell(provider, 'multiplier', provider.multiplier, 'number', 'min="0" step="0.0001" aria-label="渠道倍率"')}</td>
      ${showOfficial ? `
        <td class="official-price-cell">${editableCell(provider, originalPriceField(provider, 'input'), provider.originalInputPrice, 'number', 'min="0" step="0.0001" aria-label="原始输入价"')}</td>
        <td class="official-price-cell">${editableCell(provider, originalPriceField(provider, 'output'), provider.originalOutputPrice, 'number', 'min="0.0001" step="0.0001" aria-label="原始输出价"')}</td>
        <td class="official-price-cell">${editableCell(provider, originalPriceField(provider, 'cache'), provider.originalCachePrice, 'number', 'min="0" step="0.0001" aria-label="原始缓存价"')}</td>
      ` : ''}
      <td class="muted actual-price">${formatUnitPrice(provider.actualInputPrice, '¥')}</td>
      <td class="muted actual-price">${formatUnitPrice(provider.actualOutputPrice, '¥')}</td>
      <td class="muted actual-price">${formatUnitPrice(provider.actualCachePrice, '¥')}</td>
      <td class="highlight">${formatMillion(provider.outputForCurrent)}M</td>
      <td class="highlight price-cost">${formatMoney(provider.targetCostCny)}</td>
      <td><button class="delete-btn" type="button" data-id="${provider.id}" aria-label="删除 ${escapeHtml(provider.name)}">删除</button></td>
    </tr>`;
  }).join('');
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
    const mustBePositive = ['rechargeCny', 'usdCredit', 'cnyCredit', 'officialOutputPrice', 'cnyOutputPrice'];
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
    pricingMode: providerMode(provider),
    name: String(provider.name || '').trim(),
    rechargeCny: Number(provider.rechargeCny),
    usdCredit: Number(provider.usdCredit || 0),
    cnyCredit: Number(provider.cnyCredit || 0),
    officialInputPrice: Number(provider.officialInputPrice || 0),
    officialOutputPrice: Number(provider.officialOutputPrice || 0),
    officialCachePrice: Number(provider.officialCachePrice || 0),
    cnyInputPrice: Number(provider.cnyInputPrice || 0),
    cnyOutputPrice: Number(provider.cnyOutputPrice || 0),
    cnyCachePrice: Number(provider.cnyCachePrice || 0),
    multiplier: Number(provider.multiplier || 0),
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

providerPricingMode.addEventListener('change', () => {
  applyPricingModeToForm(providerPricingMode.value);
});

providerForm.addEventListener('submit', event => {
  event.preventDefault();
  const formData = new FormData(providerForm);
  const pricingMode = formData.get('providerPricingMode') === 'cny' ? 'cny' : 'usd';
  const baseProvider = {
    pricingMode,
    name: formData.get('providerName'),
    rechargeCny: formData.get('providerCny'),
  };

  const nextProvider = normalizeProvider(pricingMode === 'cny'
    ? {
      ...baseProvider,
      cnyCredit: formData.get('providerUsd'),
      cnyInputPrice: formData.get('providerOfficialInput'),
      cnyOutputPrice: formData.get('providerOfficialOutput'),
      cnyCachePrice: formData.get('providerOfficialCache'),
    }
    : {
      ...baseProvider,
      usdCredit: formData.get('providerUsd'),
      officialInputPrice: formData.get('providerOfficialInput'),
      officialOutputPrice: formData.get('providerOfficialOutput'),
      officialCachePrice: formData.get('providerOfficialCache'),
      multiplier: formData.get('providerMultiplier'),
    });

  if (!nextProvider) {
    showMessage(pricingMode === 'cny'
      ? '请把渠道名称、充值金额、到账人民币和人民币单价填成有效数字。'
      : '请把渠道名称、充值金额、美元额度、官方价格和倍率都填成有效数字。');
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

function applyPricingModeToForm(mode) {
  const isCnyMode = mode === 'cny';
  providerCreditLabel.textContent = isCnyMode ? '到账人民币余额' : '到账美元额度';
  providerInputPriceLabel.textContent = isCnyMode ? '输入价（人民币/M）' : '官方输入价（美元/M）';
  providerOutputPriceLabel.textContent = isCnyMode ? '输出价（人民币/M）' : '官方输出价（美元/M）';
  providerCachePriceLabel.textContent = isCnyMode ? '缓存价（人民币/M，可填 0）' : '官方缓存价（美元/M）';
  providerMultiplierLabel.classList.toggle('is-hidden', isCnyMode);
  document.querySelector('#providerUsd').placeholder = isCnyMode ? '例如：100' : '例如：100';
  document.querySelector('#providerOfficialInput').placeholder = isCnyMode ? '例如：3' : '默认：5';
  document.querySelector('#providerOfficialOutput').placeholder = isCnyMode ? '例如：24' : '默认：30';
  document.querySelector('#providerOfficialCache').placeholder = isCnyMode ? '没有就填 0' : '默认：0.5';
  document.querySelector('#providerMultiplier').required = !isCnyMode;
  if (isCnyMode) document.querySelector('#providerMultiplier').value = 1;
}

function setFormDefaults() {
  providerPricingMode.value = 'usd';
  document.querySelector('#providerOfficialInput').value = OFFICIAL_PRICE.inputPrice;
  document.querySelector('#providerOfficialOutput').value = OFFICIAL_PRICE.outputPrice;
  document.querySelector('#providerOfficialCache').value = OFFICIAL_PRICE.cachePrice;
  document.querySelector('#providerMultiplier').value = 1;
  applyPricingModeToForm('usd');
}

initializeData();
