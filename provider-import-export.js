(function () {
  const {
    normalizePerceivedSpeed,
    normalizeProviderTag,
    normalizeProviderUrl,
    normalizeProvider,
    providerMode,
  } = window.ProviderCore;

  function buildExportPayload(providers) {
    return {
      exportedAt: new Date().toISOString(),
      app: '中转站输出价格对比',
      version: 1,
      providers,
    };
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
      tag: normalizeProviderTag(provider.tag ?? provider.type),
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

  function mergeImportedProviders(currentProviders, importedProviders) {
    const existingKeys = new Set(currentProviders.map(providerDataKey));
    const usedNames = new Set(currentProviders.map(provider => provider.name));
    const merged = [...currentProviders];
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

  window.ProviderImportExport = {
    buildExportPayload,
    parseImportedProviders,
    coreProviderData,
    providerDataKey,
    providerValueKey,
    mergeImportedProviders,
  };
})();
