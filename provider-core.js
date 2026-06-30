(function () {
  const CNY_PER_USD = 6.8;
  const OFFICIAL_PRICE = {
    inputPrice: 5,
    outputPrice: 30,
    cachePrice: 0.5,
  };
  const SPEED_OPTIONS = ['快', '中', '慢'];
  const PROVIDER_TAG_OPTIONS = ['normal', 'official'];
  const PROVIDER_TAG_LABELS = {
    normal: '普通渠道',
    official: '官方渠道',
  };

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

  function normalizeProviderTag(value) {
    const text = String(value || '').trim();
    if (text === '普通渠道') return 'normal';
    if (text === '官方渠道') return 'official';
    return PROVIDER_TAG_OPTIONS.includes(text) ? text : '';
  }

  function providerTagLabel(provider) {
    const tag = normalizeProviderTag(provider?.tag ?? provider?.type);
    return tag ? PROVIDER_TAG_LABELS[tag] : '';
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
    const tag = normalizeProviderTag(provider?.tag ?? provider?.type);
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
        tag,
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
      tag,
      rechargeCny,
      usdCredit,
      officialInputPrice,
      officialOutputPrice,
      officialCachePrice,
      multiplier,
    };
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

  function displayPriceSet(provider, displayMode = 'original') {
    if (displayMode === 'cny') {
      return {
        currency: '¥',
        input: actualInputPrice(provider),
        output: actualOutputPrice(provider),
        cache: actualCachePrice(provider),
      };
    }

    if (displayMode === 'usd') {
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

  function displayPriceLabels(displayMode = 'original') {
    if (displayMode === 'cny') return ['人民币输入', '人民币输出', '人民币缓存'];
    if (displayMode === 'usd') return ['美元输入', '美元输出', '美元缓存'];
    return ['输入价格', '输出价格', '缓存价格'];
  }

  function displayPricePrefix(displayMode = 'original') {
    if (displayMode === 'cny') return '人民币';
    if (displayMode === 'usd') return '美元';
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

  window.ProviderCore = {
    CNY_PER_USD,
    OFFICIAL_PRICE,
    SPEED_OPTIONS,
    PROVIDER_TAG_OPTIONS,
    PROVIDER_TAG_LABELS,
    defaultProviders,
    cloneDefaultProviders,
    providerMode,
    normalizePerceivedSpeed,
    normalizeProviderTag,
    providerTagLabel,
    speedDisplay,
    normalizeProviderUrl,
    normalizeProvider,
    creditAmount,
    creditCurrency,
    originalInputPrice,
    originalOutputPrice,
    originalCachePrice,
    originalPriceCurrency,
    cnyPerCreditUnit,
    actualInputPrice,
    actualOutputPrice,
    actualCachePrice,
    cnyToUsdPrice,
    displayPriceSet,
    displayPriceLabels,
    displayPricePrefix,
    outputFor,
    formatMillion,
    formatPrice,
    formatMoney,
    readPositiveNumberInput,
    formatFormNumber,
    derivedMultiplierFromActualPrices,
    modeLabel,
    formatUnitPrice,
    creditField,
    originalPriceField,
    escapeHtml,
  };
})();
