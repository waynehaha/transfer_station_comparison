const STORAGE_KEY = 'modelRelayPriceProviders:v4';
const API_URL = '/api/providers';
const STATIC_DATA_URL = './data/providers.json';
const CNY_PER_USD = 6.8;
const OFFICIAL_PRICE = {
  inputPrice: 5,
  outputPrice: 30,
  cachePrice: 0.5,
};
const SPEED_OPTIONS = ['快', '中', '慢'];

const defaultProviders = [
  {
    id: crypto.randomUUID(),
    pricingMode: 'usd',
    name: 'su8-max',
    siteUrl: '',
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
    siteUrl: '',
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
    siteUrl: '',
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
let priceDisplayMode = 'original';
let saveTimer = null;
let importMode = 'merge';
let editingProviderId = null;
let editDraft = null;
let pendingDeleteProviderId = null;
let officialVisibleBeforeEdit = null;
let isReadOnlyMode = false;

const rowsEl = document.querySelector('#priceRows');
const tableHeadRow = document.querySelector('#priceHeadRow');
const tableWrap = document.querySelector('.table-wrap');
const restoreDefaultsBtn = document.querySelector('#restoreDefaultsBtn');
const exportDataBtn = document.querySelector('#exportDataBtn');
const importDataBtn = document.querySelector('#importDataBtn');
const importDataInput = document.querySelector('#importDataInput');
const providerForm = document.querySelector('#providerForm');
const providerPricingMode = document.querySelector('#providerPricingMode');
const providerSpeed = document.querySelector('#providerSpeed');
const providerCreditLabel = document.querySelector('#providerCreditLabel');
const providerActualInput = providerForm.querySelector('#providerActualInput');
const providerActualOutput = providerForm.querySelector('#providerActualOutput');
const providerActualCache = providerForm.querySelector('#providerActualCache');
const providerActualInputLabel = document.querySelector('#providerActualInputLabel');
const providerActualOutputLabel = document.querySelector('#providerActualOutputLabel');
const providerActualCacheLabel = document.querySelector('#providerActualCacheLabel');
const actualPriceFields = providerForm.querySelectorAll('.actual-price-field');
const providerInputPriceLabel = document.querySelector('#providerInputPriceLabel');
const providerOutputPriceLabel = document.querySelector('#providerOutputPriceLabel');
const providerCachePriceLabel = document.querySelector('#providerCachePriceLabel');
const providerMultiplierLabel = document.querySelector('#providerMultiplierLabel');
const editProviderModal = document.querySelector('#editProviderModal');
const editProviderForm = document.querySelector('#editProviderForm');
const editProviderPricingMode = document.querySelector('#editProviderPricingMode');
const editProviderSpeed = document.querySelector('#editProviderSpeed');
const editProviderCreditLabel = document.querySelector('#editProviderCreditLabel');
const editProviderActualInput = editProviderForm.querySelector('#editProviderActualInput');
const editProviderActualOutput = editProviderForm.querySelector('#editProviderActualOutput');
const editProviderActualCache = editProviderForm.querySelector('#editProviderActualCache');
const editProviderActualInputLabel = document.querySelector('#editProviderActualInputLabel');
const editProviderActualOutputLabel = document.querySelector('#editProviderActualOutputLabel');
const editProviderActualCacheLabel = document.querySelector('#editProviderActualCacheLabel');
const editProviderActualPriceFields = editProviderForm.querySelectorAll('.actual-price-field');
const editProviderInputPriceLabel = document.querySelector('#editProviderInputPriceLabel');
const editProviderOutputPriceLabel = document.querySelector('#editProviderOutputPriceLabel');
const editProviderCachePriceLabel = document.querySelector('#editProviderCachePriceLabel');
const editProviderMultiplierLabel = document.querySelector('#editProviderMultiplierLabel');
const closeEditModalBtn = document.querySelector('#closeEditModalBtn');
const cancelEditProviderBtn = document.querySelector('#cancelEditProviderBtn');
const deleteProviderModal = document.querySelector('#deleteProviderModal');
const deleteProviderText = document.querySelector('#deleteProviderText');
const closeDeleteModalBtn = document.querySelector('#closeDeleteModalBtn');
const cancelDeleteProviderBtn = document.querySelector('#cancelDeleteProviderBtn');
const confirmDeleteProviderBtn = document.querySelector('#confirmDeleteProviderBtn');
const formMessage = document.querySelector('#formMessage');
const officialToggleBtn = document.querySelector('#officialToggleBtn');
const officialVisibilityHint = document.querySelector('#officialVisibilityHint');
const displayModeButtons = document.querySelectorAll('.display-mode-btn');

function loadProviders() {
  return cloneDefaultProviders();
}

async function fetchProviderList(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('数据读取失败');
  const data = await response.json();
  const list = Array.isArray(data.providers) ? data.providers : data;
  if (!Array.isArray(list)) return [];
  return list.map(normalizeProvider).filter(Boolean);
}

async function loadProjectProviders() {
  try {
    const list = await fetchProviderList(API_URL);
    setReadOnlyMode(false);
    return list;
  } catch (apiError) {
    const list = await fetchProviderList(STATIC_DATA_URL);
    setReadOnlyMode(true);
    return list;
  }
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
    siteUrl: item.siteUrl || '',
    perceivedSpeed: normalizePerceivedSpeed(item.perceivedSpeed ?? item.speed),
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

function normalizePerceivedSpeed(value) {
  const text = String(value || '').trim();
  return SPEED_OPTIONS.includes(text) ? text : '';
}

function speedDisplay(provider) {
  return normalizePerceivedSpeed(provider?.perceivedSpeed ?? provider?.speed) || '-';
}

function normalizeProviderUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.href;
  } catch (error) {
    return '';
  }
}

function normalizeProvider(provider) {
  const pricingMode = providerMode(provider);
  const name = String(provider?.name || '').trim();
  const siteUrl = normalizeProviderUrl(provider?.siteUrl ?? provider?.link ?? provider?.url ?? provider?.href);
  const perceivedSpeed = normalizePerceivedSpeed(provider?.perceivedSpeed ?? provider?.speed);
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
      siteUrl,
      perceivedSpeed,
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
    siteUrl,
    perceivedSpeed,
    rechargeCny,
    usdCredit,
    officialInputPrice,
    officialOutputPrice,
    officialCachePrice,
    multiplier,
  };
}

function setReadOnlyMode(nextValue) {
  isReadOnlyMode = Boolean(nextValue);
  document.body.classList.toggle('is-readonly', isReadOnlyMode);
  tableWrap?.classList.toggle('is-readonly', isReadOnlyMode);
}

function ensureWritableMode(message = '当前是只读展示模式，不能在线修改。') {
  if (!isReadOnlyMode) return true;
  showMessage(message);
  return false;
}

async function persistProviders() {
  if (isReadOnlyMode) throw new Error('只读展示模式不能保存');
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providers }),
  });
  if (!response.ok) throw new Error('保存失败');
}

function saveProviders() {
  if (isReadOnlyMode) {
    showMessage('当前是只读展示模式，不能在线保存。');
    return;
  }
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
  const urlParams = new URLSearchParams(window.location.search);
  const requestedReadOnlyMode = ['1', 'true', 'yes'].includes((urlParams.get('readonly') || urlParams.get('readOnly') || '').toLowerCase());
  try {
    const projectProviders = await loadProjectProviders();
    if (requestedReadOnlyMode) setReadOnlyMode(true);
    const legacyProviders = readLegacyBrowserProviders();
    const defaults = cloneDefaultProviders();
    const hasLegacyChanges = legacyProviders.length > 0 && providerSignature(legacyProviders) !== providerSignature(defaults);
    const projectLooksDefault = providerSignature(projectProviders) === providerSignature(defaults);

    providers = projectProviders.length ? projectProviders : defaults;

    if (!isReadOnlyMode && hasLegacyChanges && projectLooksDefault && !localStorage.getItem('projectDataMigrated:v1')) {
      providers = legacyProviders;
      saveProviders();
      localStorage.setItem('projectDataMigrated:v1', 'true');
      showMessage('已把浏览器里的旧数据同步到项目文件。');
    }
  } catch (error) {
    console.warn('项目数据读取失败，临时使用浏览器数据。', error);
    const legacyProviders = readLegacyBrowserProviders();
    providers = legacyProviders.length ? legacyProviders : cloneDefaultProviders();
    setReadOnlyMode(requestedReadOnlyMode);
    if (!requestedReadOnlyMode) showMessage('没有读取到项目数据，临时使用浏览器数据。');
  }
  setFormDefaults();
  render();
  if (tableWrap) tableWrap.scrollLeft = 0;
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

function originalPriceCurrency(provider) {
  return providerMode(provider) === 'cny' ? '¥' : '$';
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

function cnyToUsdPrice(value) {
  return value / CNY_PER_USD;
}

function displayPriceSet(provider) {
  if (priceDisplayMode === 'cny') {
    return {
      currency: '¥',
      input: actualInputPrice(provider),
      output: actualOutputPrice(provider),
      cache: actualCachePrice(provider),
    };
  }

  if (priceDisplayMode === 'usd') {
    return {
      currency: '$',
      input: cnyToUsdPrice(actualInputPrice(provider)),
      output: cnyToUsdPrice(actualOutputPrice(provider)),
      cache: cnyToUsdPrice(actualCachePrice(provider)),
    };
  }

  return {
    currency: originalPriceCurrency(provider),
    input: originalInputPrice(provider),
    output: originalOutputPrice(provider),
    cache: originalCachePrice(provider),
  };
}

function displayPriceLabels() {
  if (priceDisplayMode === 'cny') return ['人民币输入', '人民币输出', '人民币缓存'];
  if (priceDisplayMode === 'usd') return ['美元输入', '美元输出', '美元缓存'];
  return ['输入价格', '输出价格', '缓存价格'];
}

function displayPricePrefix() {
  if (priceDisplayMode === 'cny') return '人民币';
  if (priceDisplayMode === 'usd') return '美元';
  return '原始';
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

function readPositiveNumberInput(input) {
  const value = Number(input?.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatFormNumber(value) {
  if (!Number.isFinite(value)) return '';
  return Number.parseFloat(value.toFixed(6)).toString();
}

function derivedMultiplierFromActualPrices(controls) {
  const officialOutput = readPositiveNumberInput(controls.officialOutput);
  const actualOutput = readPositiveNumberInput(controls.actualOutput);
  if (officialOutput && actualOutput) return actualOutput / officialOutput;

  const officialInput = readPositiveNumberInput(controls.officialInput);
  const actualInput = readPositiveNumberInput(controls.actualInput);
  if (officialInput && actualInput) return actualInput / officialInput;

  const officialCache = readPositiveNumberInput(controls.officialCache);
  const actualCache = readPositiveNumberInput(controls.actualCache);
  if (officialCache && actualCache) return actualCache / officialCache;

  return null;
}

function updateMultiplierFromActualPrices(controls) {
  if (controls.pricingMode.value === 'cny') return;
  const multiplier = derivedMultiplierFromActualPrices(controls);
  if (multiplier === null) return;
  controls.multiplier.value = formatFormNumber(multiplier);
}

function addFormControls() {
  return {
    pricingMode: providerPricingMode,
    actualInput: providerActualInput,
    actualOutput: providerActualOutput,
    actualCache: providerActualCache,
    officialInput: document.querySelector('#providerOfficialInput'),
    officialOutput: document.querySelector('#providerOfficialOutput'),
    officialCache: document.querySelector('#providerOfficialCache'),
    multiplier: document.querySelector('#providerMultiplier'),
  };
}

function editFormControls() {
  return {
    pricingMode: editProviderPricingMode,
    actualInput: editProviderActualInput,
    actualOutput: editProviderActualOutput,
    actualCache: editProviderActualCache,
    officialInput: document.querySelector('#editProviderOfficialInput'),
    officialOutput: document.querySelector('#editProviderOfficialOutput'),
    officialCache: document.querySelector('#editProviderOfficialCache'),
    multiplier: document.querySelector('#editProviderMultiplier'),
  };
}

function modeLabel(provider) {
  return providerMode(provider) === 'cny' ? '人民币直扣' : '美元额度';
}

function formatUnitPrice(value, currency = '¥') {
  return `${currency}${formatPrice(value)}/M`;
}

function formatDisplayUnitPrice(provider, kind) {
  const price = displayPriceSet(provider);
  return formatUnitPrice(price[kind], price.currency);
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

function measureControlTextWidth(text, element) {
  if (!element) return 0;
  const canvas = measureControlTextWidth.canvas || (measureControlTextWidth.canvas = document.createElement('canvas'));
  const context = canvas.getContext('2d');
  const style = window.getComputedStyle(element);
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return context.measureText(text).width;
}

function updateHeadControlWidths() {
  const rechargeInput = getRechargeInput();
  const moneyInput = rechargeInput?.closest('.head-money-input');
  if (rechargeInput && moneyInput) {
    const valueText = rechargeInput.value || rechargeInput.placeholder || '10';
    const valueWidth = measureControlTextWidth(valueText, rechargeInput);
    moneyInput.style.setProperty('--head-money-width', `${Math.ceil(valueWidth + 48)}px`);
  }

  const tokenSelect = getTargetTokenSelect();
  if (tokenSelect) {
    const optionText = tokenSelect.selectedOptions?.[0]?.textContent || '1亿 tokens';
    const optionWidth = measureControlTextWidth(optionText, tokenSelect);
    tokenSelect.style.setProperty('--target-select-width', `${Math.ceil(optionWidth + 42)}px`);
  }
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
    providerMode(provider) === providerMode(first) &&
    originalInputPrice(provider) === originalInputPrice(first) &&
    originalOutputPrice(provider) === originalOutputPrice(first) &&
    originalCachePrice(provider) === originalCachePrice(first)
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
  const safeValue = ['text', 'url'].includes(type) ? escapeHtml(value) : value;
  return `<input class="table-input" data-id="${provider.id}" data-field="${field}" type="${type}" value="${safeValue}" ${extra}>`;
}

function prefixedEditableCell(provider, field, value, prefix, extra = '') {
  return `<div class="prefixed-input"><span>${prefix}</span>${editableCell(provider, field, value, 'number', extra)}</div>`;
}


function cloneProvider(provider) {
  return JSON.parse(JSON.stringify(provider));
}

function tableText(value, className = '') {
  return `<span class="table-value ${className}">${escapeHtml(value)}</span>`;
}


function providerNameDisplay(provider) {
  const cnyBadge = providerMode(provider) === 'cny'
    ? '<span class="mode-pill mode-cny provider-mode-badge">人民币直扣</span>'
    : '';
  const safeName = escapeHtml(provider.name);
  const safeUrl = normalizeProviderUrl(provider.siteUrl);
  const nameContent = safeUrl
    ? `<a class="provider-name-link provider-name-value" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${safeName}</a>`
    : tableText(provider.name, 'provider-name-value');
  return `<div class="provider-name-stack">${nameContent}${cnyBadge}</div>`;
}

function rawPriceValue(provider, kind) {
  if (providerMode(provider) === 'cny') {
    return { input: provider.cnyInputPrice, output: provider.cnyOutputPrice, cache: provider.cnyCachePrice }[kind];
  }
  return { input: provider.officialInputPrice, output: provider.officialOutputPrice, cache: provider.officialCachePrice }[kind];
}

function beginEditProvider(id) {
  const provider = providers.find(item => item.id === id);
  if (!provider) return;
  editingProviderId = id;
  editDraft = cloneProvider(provider);
  render({ preserveTableHead: true });
  fillEditProviderForm(editDraft);
  openEditModal();
}

function clearEditState(options = {}) {
  if (officialVisibleBeforeEdit !== null && options.restoreOfficial !== false) {
    forceShowOfficialPrices = officialVisibleBeforeEdit;
  }
  editingProviderId = null;
  editDraft = null;
  officialVisibleBeforeEdit = null;
}

function saveEditProvider() {
  if (!editingProviderId) return;
  const pricingMode = editProviderPricingMode.value === 'cny' ? 'cny' : 'usd';
  if (pricingMode === 'usd') updateMultiplierFromActualPrices(editFormControls());
  const formData = new FormData(editProviderForm);
  const baseProvider = {
    pricingMode,
    name: formData.get('providerName'),
    siteUrl: formData.get('providerLink'),
    perceivedSpeed: formData.get('providerSpeed'),
    rechargeCny: formData.get('providerCny'),
  };
  const normalized = normalizeProvider(pricingMode === 'cny'
    ? {
      ...baseProvider,
      cnyCredit: formData.get('providerCredit'),
      cnyInputPrice: formData.get('providerOfficialInput'),
      cnyOutputPrice: formData.get('providerOfficialOutput'),
      cnyCachePrice: formData.get('providerOfficialCache'),
    }
    : {
      ...baseProvider,
      usdCredit: formData.get('providerCredit'),
      officialInputPrice: formData.get('providerOfficialInput'),
      officialOutputPrice: formData.get('providerOfficialOutput'),
      officialCachePrice: formData.get('providerOfficialCache'),
      multiplier: formData.get('providerMultiplier'),
    });
  if (!normalized) {
    showMessage(pricingMode === 'cny'
      ? '请确认名称、充值金额、到账人民币和人民币价格都有效。'
      : '请确认名称、充值金额、美元额度、官方价格和倍率都有效。');
    return;
  }

  normalized.id = editingProviderId;
  providers = providers.map(provider => provider.id === editingProviderId ? normalized : provider);
  clearEditState();
  closeEditModal();
  saveProviders();
  render();
  showMessage(`已保存「${normalized.name}」。`);
}

function cancelEditProvider() {
  clearEditState();
  closeEditModal();
  render({ preserveTableHead: true });
}

function openEditModal() {
  editProviderModal.classList.add('is-open');
  editProviderModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-open-modal');
  window.setTimeout(() => document.querySelector('#editProviderName')?.focus(), 0);
}

function closeEditModal() {
  editProviderModal.classList.remove('is-open');
  editProviderModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-open-modal');
}

function openDeleteModal(id) {
  const provider = providers.find(item => item.id === id);
  if (!provider) return;
  pendingDeleteProviderId = id;
  deleteProviderText.textContent = `确认删除「${provider.name}」？删除后不能直接撤回。`;
  deleteProviderModal.classList.add('is-open');
  deleteProviderModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-open-modal');
  window.setTimeout(() => confirmDeleteProviderBtn?.focus(), 0);
}

function closeDeleteModal() {
  pendingDeleteProviderId = null;
  deleteProviderModal.classList.remove('is-open');
  deleteProviderModal.setAttribute('aria-hidden', 'true');
  if (!editProviderModal.classList.contains('is-open')) {
    document.body.classList.remove('has-open-modal');
  }
}

function confirmDeleteProvider() {
  if (!pendingDeleteProviderId) return;
  const provider = providers.find(item => item.id === pendingDeleteProviderId);
  providers = providers.filter(item => item.id !== pendingDeleteProviderId);
  if (editingProviderId === pendingDeleteProviderId) clearEditState();
  closeDeleteModal();
  saveProviders();
  render();
  showMessage(provider ? `已删除「${provider.name}」。` : '已删除渠道。');
}

function setEditValue(selector, value) {
  const input = document.querySelector(selector);
  if (input) input.value = value ?? '';
}

function fillEditProviderForm(provider) {
  const mode = providerMode(provider);
  editProviderForm.reset();
  setEditValue('#editProviderName', provider.name);
  setEditValue('#editProviderLink', provider.siteUrl || '');
  editProviderPricingMode.value = mode;
  editProviderSpeed.value = normalizePerceivedSpeed(provider.perceivedSpeed ?? provider.speed);
  setEditValue('#editProviderCny', provider.rechargeCny);
  setEditValue('#editProviderCredit', creditAmount(provider));
  setEditValue('#editProviderOfficialInput', rawPriceValue(provider, 'input'));
  setEditValue('#editProviderOfficialOutput', rawPriceValue(provider, 'output'));
  setEditValue('#editProviderOfficialCache', rawPriceValue(provider, 'cache'));
  setEditValue('#editProviderMultiplier', mode === 'cny' ? 1 : provider.multiplier);
  if (mode === 'usd') {
    setEditValue('#editProviderActualInput', formatFormNumber(originalInputPrice(provider)));
    setEditValue('#editProviderActualOutput', formatFormNumber(originalOutputPrice(provider)));
    setEditValue('#editProviderActualCache', formatFormNumber(originalCachePrice(provider)));
  } else {
    setEditValue('#editProviderActualInput', '');
    setEditValue('#editProviderActualOutput', '');
    setEditValue('#editProviderActualCache', '');
  }
  applyEditPricingModeToForm(mode);
}

function renderProviderRow(provider, showOfficial) {
  const viewProvider = provider;
  const isCnyMode = providerMode(viewProvider) === 'cny';
  const [inputLabel, outputLabel, cacheLabel] = displayPriceLabels().map(escapeHtml);
  const targetPriceLabel = escapeHtml(targetOutputPriceLabel());
  const actionButtons = isReadOnlyMode
    ? ''
    : `<div class="row-actions">
          <button class="edit-btn" type="button" data-id="${provider.id}" aria-label="编辑 ${escapeHtml(viewProvider.name)}">编辑</button>
          <button class="delete-btn" type="button" data-id="${provider.id}" aria-label="删除 ${escapeHtml(viewProvider.name)}">删除</button>
        </div>`;

  const directPriceEditCells = `
      <td class="muted actual-price" data-label="${inputLabel}">${formatDisplayUnitPrice(viewProvider, 'input')}</td>
      <td class="muted actual-price" data-label="${outputLabel}">${formatDisplayUnitPrice(viewProvider, 'output')}</td>
      <td class="muted actual-price" data-label="${cacheLabel}">${formatDisplayUnitPrice(viewProvider, 'cache')}</td>`;

  const detailCells = `
      <td data-label="充值金额">${tableText(viewProvider.rechargeCny)}</td>
      <td data-label="到账额度">${tableText(creditCurrency(viewProvider), 'currency-symbol')} ${tableText(creditAmount(viewProvider))}</td>
      <td data-label="渠道倍率">${isCnyMode ? '<span class="muted muted-dash">-</span>' : tableText(viewProvider.multiplier)}</td>
      <td data-label="体感速度">${tableText(speedDisplay(viewProvider))}</td>
      ${showOfficial ? `
        <td class="official-price-cell" data-label="官方输入">${tableText(formatUnitPrice(rawPriceValue(viewProvider, 'input'), originalPriceCurrency(viewProvider)))}</td>
        <td class="official-price-cell" data-label="官方输出">${tableText(formatUnitPrice(rawPriceValue(viewProvider, 'output'), originalPriceCurrency(viewProvider)))}</td>
        <td class="official-price-cell" data-label="官方缓存">${tableText(formatUnitPrice(rawPriceValue(viewProvider, 'cache'), originalPriceCurrency(viewProvider)))}</td>
      ` : ''}
      ${directPriceEditCells}`;

  return `
    <tr class="${viewProvider.id === editingProviderId ? 'is-editing' : ''}">
      <td class="provider-cell" data-label="中转站">${providerNameDisplay(viewProvider)}</td>
      ${detailCells}
      <td class="highlight result-output" data-label="每 ¥${escapeHtml(String(getRechargeAmount()))} 输出">${formatMillion(outputFor(viewProvider, getRechargeAmount()))}M</td>
      <td class="highlight price-cost" data-label="${targetPriceLabel}">${formatMoney(costForOutput(viewProvider, getTargetTokenMillion()))}</td>
      ${isReadOnlyMode ? '' : `<td class="actions-cell" data-label="操作">${actionButtons}</td>`}
    </tr>`;
}

function renderTableHead(showOfficial) {
  const currentAmount = getRechargeAmount();
  const currentTarget = getTargetTokenMillion();
  const [inputLabel, outputLabel, cacheLabel] = displayPriceLabels();
  tableHeadRow.dataset.officialVisible = String(showOfficial);
  tableHeadRow.dataset.displayMode = priceDisplayMode;
  tableHeadRow.dataset.readonly = String(isReadOnlyMode);
  tableHeadRow.innerHTML = `
    <th>中转站</th>
    <th>充值 ¥</th>
    <th>到账</th>
    <th>渠道倍率</th>
    <th>体感速度</th>
    ${showOfficial ? '<th class="official-price-head">官方输入</th><th class="official-price-head">官方输出</th><th class="official-price-head">官方缓存</th>' : ''}
    <th>${inputLabel}</th>
    <th>${outputLabel}</th>
    <th>${cacheLabel}</th>
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
      <div class="head-stacked-control">
        <select id="targetTokenSelect" aria-label="选择目标输出量">
          <option value="1" ${currentTarget === 1 ? 'selected' : ''}>100万 tokens</option>
          <option value="10" ${currentTarget === 10 ? 'selected' : ''}>1000万 tokens</option>
          <option value="100" ${currentTarget === 100 ? 'selected' : ''}>1亿 tokens</option>
        </select>
        <span>输出价格</span>
      </div>
    </th>
    ${isReadOnlyMode ? '' : '<th>操作</th>'}
  `;
  updateHeadControlWidths();
}

function renderEmptyState() {
  const showOfficial = shouldShowOfficialColumns();
  renderTableHead(showOfficial);
  const columnCount = (showOfficial ? 13 : 10) + (isReadOnlyMode ? 0 : 1);
  rowsEl.innerHTML = `<tr><td colspan="${columnCount}" class="muted">${isReadOnlyMode ? '暂无渠道数据。' : '暂无渠道，请先新增。'}</td></tr>`;
  scheduleTableOverflowCheck();
}

function renderDisplayModeControls() {
  displayModeButtons.forEach(button => {
    const isActive = button.dataset.displayMode === priceDisplayMode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function renderOfficialControls(showOfficial, sameOfficialPrice) {
  if (!officialToggleBtn || !officialVisibilityHint) return;
  officialToggleBtn.textContent = showOfficial ? '隐藏官方价' : '显示官方价';
  officialToggleBtn.setAttribute('aria-pressed', String(showOfficial));
  const modeText = priceDisplayMode === 'original'
    ? '现在显示各渠道自己的原始报价，美元渠道显示美元，人民币渠道显示人民币。'
    : priceDisplayMode === 'usd'
      ? `现在已统一显示为美元，人民币价格按 ¥${CNY_PER_USD} ≈ $1 估算。`
      : `现在已统一显示为${displayPricePrefix()}，方便横向比较。`;
  const hintText = sameOfficialPrice
    ? `${modeText} 需要查看或修改官方基础价格时，可点“显示官方价”。`
    : `${modeText} 不同渠道的原始计价方式可能不同，切换显示方式不会改动官方价格数据。`;
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
  setReadOnlyMode(isReadOnlyMode);
  renderDisplayModeControls();
  renderOfficialControls(showOfficial, sameOfficialPrice);

  if (!providers.length) {
    renderEmptyState();
    return;
  }

  const ranked = rankedProviders(amount);


  if (!options.preserveTableHead) {
    renderTableHead(showOfficial);
  }
  rowsEl.innerHTML = ranked.map(provider => renderProviderRow(provider, showOfficial)).join('');
  updateHeadControlWidths();
  scheduleTableOverflowCheck();
}

function updateTableOverflowState() {
  if (!tableWrap) return;
  const hasHiddenColumns = tableWrap.scrollWidth > tableWrap.clientWidth + 2;
  tableWrap.classList.toggle('has-fixed-column-overlap', hasHiddenColumns);
}

function scheduleTableOverflowCheck() {
  window.requestAnimationFrame(updateTableOverflowState);
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
  } else if (field === 'siteUrl') {
    provider.siteUrl = normalizeProviderUrl(rawValue);
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
    siteUrl: normalizeProviderUrl(provider.siteUrl),
    perceivedSpeed: normalizePerceivedSpeed(provider.perceivedSpeed ?? provider.speed),
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
  if (!ensureWritableMode()) return;
  const rawText = await file.text();
  const importedProviders = parseImportedProviders(rawText);
  providers = importedProviders;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
  await persistProviders();
  forceShowOfficialPrices = false;
  priceDisplayMode = 'original';
  clearEditState({ restoreOfficial: false });
  render();
  showMessage(`已覆盖导入 ${providers.length} 个渠道，并保存到项目文件。`);
}

async function mergeProvidersFromFile(file) {
  if (!ensureWritableMode()) return;
  const rawText = await file.text();
  const importedProviders = parseImportedProviders(rawText);
  const { merged, stats } = mergeImportedProviders(importedProviders);
  providers = merged;
  clearEditState({ restoreOfficial: false });
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
  updateHeadControlWidths();
  render({ preserveTableHead: true });
});

tableHeadRow.addEventListener('change', event => {
  if (event.target?.id !== 'targetTokenSelect') return;
  updateHeadControlWidths();
  render({ preserveTableHead: true });
});

exportDataBtn.addEventListener('click', () => {
  if (!ensureWritableMode()) return;
  exportProviders();
});
importDataBtn.addEventListener('click', () => {
  if (!ensureWritableMode()) return;
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
  if (!ensureWritableMode()) return;
  providers = cloneDefaultProviders();
  clearEditState({ restoreOfficial: false });
  forceShowOfficialPrices = false;
  priceDisplayMode = 'original';
  saveProviders();
  render();
  showMessage('已恢复默认 3 个示例渠道。');
});
officialToggleBtn.addEventListener('click', () => {
  forceShowOfficialPrices = !forceShowOfficialPrices;
  render();
});

displayModeButtons.forEach(button => {
  button.addEventListener('click', () => {
    const nextMode = button.dataset.displayMode;
    if (!['original', 'cny', 'usd'].includes(nextMode)) return;
    priceDisplayMode = nextMode;
    render();
  });
});

providerPricingMode.addEventListener('change', () => {
  applyPricingModeToForm(providerPricingMode.value);
});

[providerActualInput, providerActualOutput, providerActualCache].forEach(input => {
  input?.addEventListener('input', () => updateMultiplierFromActualPrices(addFormControls()));
});

['#providerOfficialInput', '#providerOfficialOutput', '#providerOfficialCache'].forEach(selector => {
  document.querySelector(selector)?.addEventListener('input', () => updateMultiplierFromActualPrices(addFormControls()));
});

document.querySelector('#providerMultiplier')?.addEventListener('input', () => {
  [providerActualInput, providerActualOutput, providerActualCache].forEach(input => {
    if (input) input.value = '';
  });
});

function visibleFormControl(element) {
  if (!element || element.disabled) return false;
  return Boolean(element.offsetParent || element.getClientRects().length);
}

function setupRowTabOrder(form, selectors) {
  form.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = selectors
      .map(selector => form.querySelector(selector))
      .filter(visibleFormControl);
    const currentIndex = controls.indexOf(event.target);
    if (currentIndex === -1) return;
    event.preventDefault();
    const step = event.shiftKey ? -1 : 1;
    const nextIndex = (currentIndex + step + controls.length) % controls.length;
    controls[nextIndex]?.focus();
  });
}

setupRowTabOrder(providerForm, [
  '#providerName',
  '#providerLink',
  '#providerPricingMode',
  '#providerCny',
  '#providerUsd',
  '#providerActualInput',
  '#providerActualOutput',
  '#providerActualCache',
  '#providerMultiplier',
  '#providerSpeed',
  '#providerOfficialInput',
  '#providerOfficialOutput',
  '#providerOfficialCache',
  'button[type="submit"]',
]);

setupRowTabOrder(editProviderForm, [
  '#editProviderName',
  '#editProviderLink',
  '#editProviderPricingMode',
  '#editProviderCny',
  '#editProviderCredit',
  '#editProviderActualInput',
  '#editProviderActualOutput',
  '#editProviderActualCache',
  '#editProviderMultiplier',
  '#editProviderSpeed',
  '#editProviderOfficialInput',
  '#editProviderOfficialOutput',
  '#editProviderOfficialCache',
  '#cancelEditProviderBtn',
  'button[type="submit"]',
]);

editProviderPricingMode.addEventListener('change', () => {
  applyEditPricingModeToForm(editProviderPricingMode.value);
});

[editProviderActualInput, editProviderActualOutput, editProviderActualCache].forEach(input => {
  input?.addEventListener('input', () => updateMultiplierFromActualPrices(editFormControls()));
});

['#editProviderOfficialInput', '#editProviderOfficialOutput', '#editProviderOfficialCache'].forEach(selector => {
  document.querySelector(selector)?.addEventListener('input', () => updateMultiplierFromActualPrices(editFormControls()));
});

document.querySelector('#editProviderMultiplier')?.addEventListener('input', () => {
  [editProviderActualInput, editProviderActualOutput, editProviderActualCache].forEach(input => {
    if (input) input.value = '';
  });
});

editProviderForm.addEventListener('submit', event => {
  event.preventDefault();
  saveEditProvider();
});

closeEditModalBtn.addEventListener('click', cancelEditProvider);
cancelEditProviderBtn.addEventListener('click', cancelEditProvider);
editProviderModal.addEventListener('click', event => {
  if (event.target.closest('[data-close-edit-modal]')) cancelEditProvider();
});
closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
cancelDeleteProviderBtn.addEventListener('click', closeDeleteModal);
confirmDeleteProviderBtn.addEventListener('click', confirmDeleteProvider);
deleteProviderModal.addEventListener('click', event => {
  if (event.target.closest('[data-close-delete-modal]')) closeDeleteModal();
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && editProviderModal.classList.contains('is-open')) {
    cancelEditProvider();
    return;
  }
  if (event.key === 'Escape' && deleteProviderModal.classList.contains('is-open')) {
    closeDeleteModal();
  }
});

providerForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!ensureWritableMode()) return;
  const pricingMode = providerPricingMode.value === 'cny' ? 'cny' : 'usd';
  if (pricingMode === 'usd') updateMultiplierFromActualPrices(addFormControls());
  const formData = new FormData(providerForm);
  const baseProvider = {
    pricingMode,
    name: formData.get('providerName'),
    siteUrl: formData.get('providerLink'),
    perceivedSpeed: formData.get('providerSpeed'),
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
  if (isReadOnlyMode) return;

  const editButton = event.target.closest('.edit-btn');
  if (editButton) {
    beginEditProvider(editButton.dataset.id);
    return;
  }

  const deleteButton = event.target.closest('.delete-btn');
  if (!deleteButton) return;
  openDeleteModal(deleteButton.dataset.id);
});

function applyPricingModeToForm(mode) {
  const isCnyMode = mode === 'cny';
  providerCreditLabel.textContent = isCnyMode ? '到账人民币余额' : '到账美元额度';
  providerActualInputLabel.textContent = isCnyMode ? '实际输入价（人民币/M）' : '实际输入价（美元/M）';
  providerActualOutputLabel.textContent = isCnyMode ? '实际输出价（人民币/M）' : '实际输出价（美元/M）';
  providerActualCacheLabel.textContent = isCnyMode ? '实际缓存价（人民币/M）' : '实际缓存价（美元/M）';
  providerInputPriceLabel.textContent = isCnyMode ? '输入价（人民币/M）' : '官方输入价（美元/M）';
  providerOutputPriceLabel.textContent = isCnyMode ? '输出价（人民币/M）' : '官方输出价（美元/M）';
  providerCachePriceLabel.textContent = isCnyMode ? '缓存价（人民币/M，可填 0）' : '官方缓存价（美元/M）';
  actualPriceFields.forEach(field => field.classList.toggle('is-hidden', isCnyMode));
  providerMultiplierLabel.classList.toggle('is-hidden', isCnyMode);
  document.querySelector('#providerUsd').placeholder = isCnyMode ? '例如：100' : '例如：100';
  document.querySelector('#providerOfficialInput').placeholder = isCnyMode ? '例如：3' : '默认：5';
  document.querySelector('#providerOfficialOutput').placeholder = isCnyMode ? '例如：24' : '默认：30';
  document.querySelector('#providerOfficialCache').placeholder = isCnyMode ? '没有就填 0' : '默认：0.5';
  document.querySelector('#providerMultiplier').required = !isCnyMode;
  if (isCnyMode) {
    document.querySelector('#providerMultiplier').value = 1;
    [providerActualInput, providerActualOutput, providerActualCache].forEach(input => {
      if (input) input.value = '';
    });
  }
}

function applyEditPricingModeToForm(mode) {
  const isCnyMode = mode === 'cny';
  editProviderCreditLabel.textContent = isCnyMode ? '到账人民币余额' : '到账美元额度';
  editProviderActualInputLabel.textContent = isCnyMode ? '实际输入价（人民币/M）' : '实际输入价（美元/M）';
  editProviderActualOutputLabel.textContent = isCnyMode ? '实际输出价（人民币/M）' : '实际输出价（美元/M）';
  editProviderActualCacheLabel.textContent = isCnyMode ? '实际缓存价（人民币/M）' : '实际缓存价（美元/M）';
  editProviderInputPriceLabel.textContent = isCnyMode ? '输入价（人民币/M）' : '官方输入价（美元/M）';
  editProviderOutputPriceLabel.textContent = isCnyMode ? '输出价（人民币/M）' : '官方输出价（美元/M）';
  editProviderCachePriceLabel.textContent = isCnyMode ? '缓存价（人民币/M，可填 0）' : '官方缓存价（美元/M）';
  editProviderActualPriceFields.forEach(field => field.classList.toggle('is-hidden', isCnyMode));
  editProviderMultiplierLabel.classList.toggle('is-hidden', isCnyMode);
  document.querySelector('#editProviderMultiplier').required = !isCnyMode;
  if (isCnyMode) {
    document.querySelector('#editProviderMultiplier').value = 1;
    [editProviderActualInput, editProviderActualOutput, editProviderActualCache].forEach(input => {
      if (input) input.value = '';
    });
  }
}

function setFormDefaults() {
  providerPricingMode.value = 'usd';
  providerSpeed.value = '';
  document.querySelector('#providerOfficialInput').value = OFFICIAL_PRICE.inputPrice;
  document.querySelector('#providerOfficialOutput').value = OFFICIAL_PRICE.outputPrice;
  document.querySelector('#providerOfficialCache').value = OFFICIAL_PRICE.cachePrice;
  document.querySelector('#providerMultiplier').value = 1;
  [providerActualInput, providerActualOutput, providerActualCache].forEach(input => {
    if (input) input.value = '';
  });
  applyPricingModeToForm('usd');
}

function clampTableHorizontalScroll(event) {
  if (!tableWrap) return;
  const absX = Math.abs(event.deltaX);
  const absY = Math.abs(event.deltaY);
  const isPureHorizontalIntent = absX > 0 && absX > absY * 2.5;
  if (!isPureHorizontalIntent) return;

  const maxScrollLeft = tableWrap.scrollWidth - tableWrap.clientWidth;
  if (maxScrollLeft <= 0) return;

  const goingLeftPastStart = tableWrap.scrollLeft <= 0 && event.deltaX < 0;
  const goingRightPastEnd = tableWrap.scrollLeft >= maxScrollLeft - 1 && event.deltaX > 0;
  if (goingLeftPastStart || goingRightPastEnd) {
    event.preventDefault();
    tableWrap.scrollLeft = goingLeftPastStart ? 0 : maxScrollLeft;
  }
}

window.addEventListener('resize', scheduleTableOverflowCheck);
tableWrap?.addEventListener('scroll', updateTableOverflowState, { passive: true });
tableWrap?.addEventListener('wheel', clampTableHorizontalScroll, { passive: false });
if ('ResizeObserver' in window && tableWrap) {
  new ResizeObserver(scheduleTableOverflowCheck).observe(tableWrap);
}

initializeData();
