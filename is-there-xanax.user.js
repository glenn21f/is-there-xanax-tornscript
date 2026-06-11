// ==UserScript==
// @name         Is there Xanax ?
// @namespace    glenn.torn.is.there.xanax
// @version      0.6.0
// @description  Checks whether Xanax is available abroad in Japan, United Kingdom, and South Africa, then estimates whether stock is likely to still be available when you land.
// @author       Glenn
// @homepageURL  https://github.com/glenn21f/is-there-xanax-tornscript
// @supportURL   https://github.com/glenn21f/is-there-xanax-tornscript/issues
// @downloadURL  https://raw.githubusercontent.com/glenn21f/is-there-xanax-tornscript/main/is-there-xanax.user.js
// @updateURL    https://raw.githubusercontent.com/glenn21f/is-there-xanax-tornscript/main/is-there-xanax.user.js
// @license      MIT
// @match        https://www.torn.com/*
// @match        https://*.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      droqsdb.com
// @connect      yata.yt
// @connect      api.torn.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_NAME = 'Is there Xanax ?';
  const SCRIPT_VERSION = '0.6.0';
  const LS_PREFIX = 'xfp_v3_';
  const DROQS_META = 'https://droqsdb.com/api/public/v1/meta';
  const DROQS_EXPORT = 'https://droqsdb.com/api/public/v1/export';
  const YATA_EXPORT = 'https://yata.yt/api/v1/travel/export/';
  const YATA_IMPORT = 'https://yata.yt/api/v1/travel/import/';
  const DROQS_CACHE_KEY = LS_PREFIX + 'droqs_cache';
  const DROQS_COOLDOWN_KEY = LS_PREFIX + 'droqs_cooldown_until';
  const YATA_CACHE_KEY = LS_PREFIX + 'yata_cache';
  const YATA_COOLDOWN_KEY = LS_PREFIX + 'yata_cooldown_until';
  const XANAX_ID = 206;
  const XANAX_ICON_DATA = 'data:image/webp;base64,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';

  const COUNTRIES = {
    jap: {
      name: 'Japan',
      city: 'Tokyo',
      short: 'Japan',
      aliases: ['jap', 'japan', 'tokyo'],
      times: { standard: 225, airstrip: 158, wlt: 113, business: 68 },
      bookTimes: { standard: 169, airstrip: 118, wlt: 84, business: 51 }
    },
    uni: {
      name: 'United Kingdom',
      city: 'London',
      short: 'UK',
      aliases: ['uni', 'uk', 'united kingdom', 'london', 'england', 'great britain'],
      times: { standard: 159, airstrip: 111, wlt: 80, business: 48 },
      bookTimes: { standard: 119, airstrip: 84, wlt: 60, business: 36 }
    },
    sou: {
      name: 'South Africa',
      city: 'Johannesburg',
      short: 'South Africa',
      aliases: ['sou', 'south africa', 'south-africa', 'johannesburg'],
      times: { standard: 297, airstrip: 208, wlt: 149, business: 89 },
      bookTimes: { standard: 223, airstrip: 156, wlt: 112, business: 67 }
    }
  };

  const COUNTRY_ALIASES = Object.fromEntries(
    Object.entries(COUNTRIES).map(([code, meta]) => [code, meta.aliases])
  );

  const DEFAULTS = {
    apiKey: '',
    flightMode: 'airstrip',
    bookActive: false,
    desiredQty: 1,
    minStock: 50,
    freshMins: 20,
    autoMins: 2,
    autoPushYata: false,
    collapsed: true,
    compact: true
  };

  const state = {
    yata: null,
    torn: null,
    travel: null,
    rows: [],
    lastRefresh: null,
    refreshTimer: null,
    busy: false,
    error: '',
    warning: '',
    dataSource: 'live',
    dataProvider: 'DroqsDB',
    sourceMeta: null
  };

  let dragInfo = null;
  let suppressCollapseClickUntil = 0;

  function getCfg(key) {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw === null || raw === undefined) return DEFAULTS[key];
    try { return JSON.parse(raw); } catch (_) { return raw; }
  }

  function setCfg(key, value) {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  }

  function runV6Migration() {
    const key = LS_PREFIX + 'v6_migrated';
    if (localStorage.getItem(key)) return;

    // v6 is intentionally smaller and starts minimized so it does not cover Torn chat/PDA UI.
    setCfg('collapsed', true);
    setCfg('compact', true);
    localStorage.setItem(key, '1');
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalize(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[_\-]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  function nowSec() {
    return Math.floor(Date.now() / 1000);
  }

  function money(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '—';
    return '$' + Math.round(n).toLocaleString();
  }

  function qty(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n));
  }

  function minsToText(minutes) {
    if (!Number.isFinite(minutes)) return 'unknown';
    const total = Math.max(0, Math.round(minutes));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  }

  function secondsToText(seconds) {
    return minsToText(seconds / 60);
  }

  function timeFromNow(minutes) {
    if (!Number.isFinite(minutes)) return '—';
    const d = new Date(Date.now() + minutes * 60 * 1000);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function addStyle(css) {
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(css);
      return;
    }
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function compactErrorBody(value) {
    const text = String(value ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) return '';
    if (/bad gateway/i.test(text) || /error code 502/i.test(text)) return 'YATA returned 502 Bad Gateway';
    if (/cloudflare/i.test(text) && /host/i.test(text) && /error/i.test(text)) return 'YATA host is failing behind Cloudflare';
    return text.slice(0, 180) + (text.length > 180 ? '…' : '');
  }

  function normalizeError(err) {
    if (!err) return 'Unknown error';
    if (err.safeMessage) return err.safeMessage;
    const msg = String(err.message || err);
    if (/HTTP\s+502/i.test(msg)) return 'YATA returned 502 Bad Gateway';
    if (/Bad gateway/i.test(msg)) return 'YATA returned 502 Bad Gateway';
    if (/timed out/i.test(msg)) return 'Request timed out';
    if (/Network error/i.test(msg)) return 'Network error';
    return compactErrorBody(msg) || msg.slice(0, 180);
  }

  function makeHttpError(status, parsed) {
    const bodyText = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    const compact = compactErrorBody(bodyText);
    const err = new Error(`HTTP ${status}${compact ? ': ' + compact : ''}`);
    err.status = status;
    err.body = parsed;
    err.safeMessage = status === 502 ? 'YATA returned 502 Bad Gateway' : err.message;
    return err;
  }

  function requestJson(url, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const body = data ? JSON.stringify(data) : undefined;
      const headers = data ? { 'content-type': 'application/json' } : {};

      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({
          method,
          url,
          data: body,
          headers,
          timeout: 15000,
          responseType: 'json',
          onload: (res) => {
            let parsed = res.response;
            if (!parsed && typeof res.responseText === 'string') {
              try { parsed = JSON.parse(res.responseText); } catch (_) { parsed = res.responseText; }
            }
            if (res.status >= 200 && res.status < 300) resolve(parsed);
            else reject(makeHttpError(res.status, parsed));
          },
          onerror: () => {
            const err = new Error('Network error');
            err.safeMessage = 'Network error';
            reject(err);
          },
          ontimeout: () => {
            const err = new Error('Request timed out');
            err.safeMessage = 'Request timed out';
            reject(err);
          }
        });
        return;
      }

      fetch(url, { method, body, headers, credentials: 'omit', mode: 'cors' })
        .then(async (res) => {
          const text = await res.text();
          let parsed = text;
          try { parsed = JSON.parse(text); } catch (_) {}
          if (!res.ok) throw makeHttpError(res.status, parsed);
          resolve(parsed);
        })
        .catch(reject);
    });
  }

  async function requestJsonWithRetry(url, method = 'GET', data = null, opts = {}) {
    const attempts = Math.max(1, Number(opts.attempts || 3));
    const baseDelay = Math.max(250, Number(opts.baseDelay || 900));
    let lastErr = null;

    for (let i = 0; i < attempts; i += 1) {
      try {
        return await requestJson(url, method, data);
      } catch (err) {
        lastErr = err;
        const status = Number(err?.status || 0);
        const retryable = status === 0 || status === 429 || status >= 500 || /timeout|network/i.test(String(err?.message || ''));
        if (!retryable || i === attempts - 1) break;
        await sleep(baseDelay * Math.pow(1.65, i));
      }
    }

    throw lastErr;
  }

  function saveCache(key, data, meta = null) {
    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data, meta }));
    } catch (_) {}
  }

  function loadCache(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || !cached.data || !cached.savedAt) return null;
      return cached;
    } catch (_) {
      return null;
    }
  }

  function ageSince(ms) {
    if (!ms) return 'unknown age';
    const mins = Math.max(0, (Date.now() - ms) / 60000);
    return minsToText(mins) + ' old';
  }

  function droqsMetaWarning(meta) {
    if (!meta || typeof meta !== 'object') return '';
    const bits = [];

    if (meta.servingMode && meta.servingMode !== 'live') {
      bits.push(`DroqsDB mode: ${meta.servingMode}`);
    }

    if (meta.snapshotFreshness && meta.snapshotFreshness !== 'fresh') {
      bits.push(`snapshot ${meta.snapshotFreshness}`);
    }

    if (meta.snapshotAgeMs && Number(meta.snapshotAgeMs) > 0) {
      bits.push(`snapshot ${minsToText(Number(meta.snapshotAgeMs) / 60000)} old`);
    }

    const sourceAge = Number(meta.sources?.droqsdb?.ageMinutes);
    if (Number.isFinite(sourceAge) && sourceAge > Number(getCfg('freshMins') || 20)) {
      bits.push(`DroqsDB source ${minsToText(sourceAge)} old`);
    }

    return bits.length ? bits.join(' · ') + '.' : '';
  }

  async function getDroqsExport(force = false) {
    const cached = loadCache(DROQS_CACHE_KEY);
    const cooldownUntil = Number(localStorage.getItem(DROQS_COOLDOWN_KEY) || 0);

    if (!force && cached && cooldownUntil > Date.now()) {
      return {
        data: cached.data,
        meta: cached.meta || null,
        provider: 'DroqsDB',
        fromCache: true,
        cacheAt: cached.savedAt,
        warning: `DroqsDB recently failed. Using cached stock from ${ageSince(cached.savedAt)}.`
      };
    }

    try {
      const [exportResult, metaResult] = await Promise.allSettled([
        requestJsonWithRetry(DROQS_EXPORT, 'GET', null, { attempts: 3, baseDelay: 650 }),
        requestJsonWithRetry(DROQS_META, 'GET', null, { attempts: 2, baseDelay: 500 })
      ]);

      if (exportResult.status !== 'fulfilled') throw exportResult.reason;

      const meta = metaResult.status === 'fulfilled' ? metaResult.value : null;
      saveCache(DROQS_CACHE_KEY, exportResult.value, meta);
      localStorage.removeItem(DROQS_COOLDOWN_KEY);

      return {
        data: exportResult.value,
        meta,
        provider: 'DroqsDB',
        fromCache: false,
        cacheAt: Date.now(),
        warning: droqsMetaWarning(meta)
      };
    } catch (err) {
      const reason = normalizeError(err).replace(/^YATA/i, 'DroqsDB');
      localStorage.setItem(DROQS_COOLDOWN_KEY, String(Date.now() + 60 * 1000));

      if (cached) {
        return {
          data: cached.data,
          meta: cached.meta || null,
          provider: 'DroqsDB',
          fromCache: true,
          cacheAt: cached.savedAt,
          warning: `${reason}. Using cached DroqsDB stock from ${ageSince(cached.savedAt)}.`
        };
      }

      throw new Error(`${reason}. No cached DroqsDB stock yet.`);
    }
  }

  async function getYataExport(force = false) {
    const cached = loadCache(YATA_CACHE_KEY);
    const cooldownUntil = Number(localStorage.getItem(YATA_COOLDOWN_KEY) || 0);

    if (!force && cached && cooldownUntil > Date.now()) {
      return {
        data: cached.data,
        meta: null,
        provider: 'YATA',
        fromCache: true,
        cacheAt: cached.savedAt,
        warning: `YATA recently failed. Using cached stock from ${ageSince(cached.savedAt)}.`
      };
    }

    try {
      const data = await requestJsonWithRetry(YATA_EXPORT, 'GET', null, { attempts: 3, baseDelay: 800 });
      saveCache(YATA_CACHE_KEY, data, null);
      localStorage.removeItem(YATA_COOLDOWN_KEY);
      return { data, meta: null, provider: 'YATA', fromCache: false, cacheAt: Date.now(), warning: '' };
    } catch (err) {
      const reason = normalizeError(err);
      localStorage.setItem(YATA_COOLDOWN_KEY, String(Date.now() + 90 * 1000));

      if (cached) {
        return {
          data: cached.data,
          meta: null,
          provider: 'YATA',
          fromCache: true,
          cacheAt: cached.savedAt,
          warning: `${reason}. Using cached YATA stock from ${ageSince(cached.savedAt)}.`
        };
      }

      throw new Error(`${reason}. No cached YATA stock yet.`);
    }
  }

  async function getTravelStock(force = false) {
    try {
      return await getDroqsExport(force);
    } catch (droqsErr) {
      try {
        const fallback = await getYataExport(force);
        const droqsReason = normalizeError(droqsErr);
        fallback.warning = `${droqsReason}. Falling back to ${fallback.provider}${fallback.fromCache ? ' cache' : ''}.${fallback.warning ? ' ' + fallback.warning : ''}`;
        return fallback;
      } catch (yataErr) {
        const droqsReason = normalizeError(droqsErr);
        const yataReason = normalizeError(yataErr);
        throw new Error(`DroqsDB failed: ${droqsReason}. YATA failed: ${yataReason}.`);
      }
    }
  }

  function parseTimestamp(value) {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d+(\.\d+)?$/.test(trimmed)) return parseTimestamp(Number(trimmed));
      const ms = Date.parse(trimmed);
      return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
    }

    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (n > 1000000000000) return Math.floor(n / 1000); // epoch ms
    if (n > 1000000000) return Math.floor(n); // epoch sec
    return null;
  }

  function firstTimestamp(...values) {
    for (const value of values) {
      const parsed = parseTimestamp(value);
      if (parsed) return parsed;
    }
    return null;
  }

  function itemNameFrom(row) {
    const item = row?.item && typeof row.item === 'object' ? row.item : null;
    return row?.itemName ?? row?.item_name ?? row?.name ?? row?.item ?? item?.name ?? item?.itemName ?? '';
  }

  function itemIdFrom(row) {
    const item = row?.item && typeof row.item === 'object' ? row.item : null;
    return Number(row?.id ?? row?.item_id ?? row?.itemId ?? row?.itemid ?? row?.itemID ?? item?.id ?? item?.item_id ?? item?.itemId);
  }

  function isXanaxRow(row) {
    if (!row || typeof row !== 'object') return false;
    const id = itemIdFrom(row);
    const name = normalize(itemNameFrom(row));
    return id === XANAX_ID || name === 'xanax';
  }

  function countryMatches(value, code) {
    const aliases = COUNTRY_ALIASES[code] || [];
    const t = normalize(value);
    if (!t) return false;
    if (t === code) return true;
    return aliases.some((a) => t === normalize(a) || t.includes(normalize(a)));
  }

  function rowMatchesCountry(row, code) {
    if (!row || typeof row !== 'object') return false;
    const country = row.country && typeof row.country === 'object' ? row.country : null;
    const candidates = [
      row.country,
      row.countryName,
      row.country_name,
      row.countryCode,
      row.country_code,
      row.countryKey,
      row.destination,
      row.destinationName,
      row.location,
      row.city,
      row.region,
      country?.name,
      country?.code,
      country?.key,
      country?.slug
    ];
    return candidates.some((value) => countryMatches(value, code));
  }

  function findCountryPayload(stocksRoot, code) {
    if (!stocksRoot) return null;

    if (Array.isArray(stocksRoot)) {
      return stocksRoot.find((value) => rowMatchesCountry(value, code)) || null;
    }

    if (typeof stocksRoot !== 'object') return null;
    if (stocksRoot[code]) return stocksRoot[code];

    const aliases = COUNTRY_ALIASES[code] || [];
    for (const [key, value] of Object.entries(stocksRoot)) {
      const k = normalize(key);
      if (aliases.includes(k) || k === code) return value;
      if (rowMatchesCountry(value, code)) return value;
      const countryName = normalize(value?.country || value?.name || value?.destination || '');
      if (aliases.includes(countryName)) return value;
    }
    return null;
  }

  function stockQtyFrom(row) {
    return qty(
      row?.quantity ??
      row?.stock ??
      row?.amount ??
      row?.qty ??
      row?.currentStock ??
      row?.current_stock ??
      row?.overseasStock ??
      row?.overseas_stock ??
      row?.availableStock ??
      row?.available_stock ??
      row?.available ??
      row?.inStock ??
      row?.in_stock
    );
  }

  function priceFrom(row) {
    const n = Number(
      row?.overseasPrice ??
      row?.overseas_price ??
      row?.abroadPrice ??
      row?.abroad_price ??
      row?.cost ??
      row?.price ??
      row?.buy_price ??
      row?.buyPrice
    );
    return Number.isFinite(n) ? n : 0;
  }

  function updateFrom(row, countryPayload, exportData) {
    return firstTimestamp(
      row?.stockUpdatedAt,
      row?.stock_updated_at,
      row?.updatedAt,
      row?.updated_at,
      row?.lastUpdated,
      row?.last_updated,
      row?.pricingUpdatedAt,
      row?.timestamp,
      row?.update,
      countryPayload?.stockUpdatedAt,
      countryPayload?.updatedAt,
      countryPayload?.lastUpdated,
      countryPayload?.timestamp,
      countryPayload?.update,
      exportData?.generatedAt,
      exportData?.updatedAt,
      exportData?.lastUpdated,
      exportData?.timestamp,
      exportData?.update,
      exportData?.data?.generatedAt,
      exportData?.data?.updatedAt,
      exportData?.data?.lastUpdated,
      exportData?.data?.timestamp,
      exportData?.data?.update
    );
  }

  function extractFromCountryPayload(exportData, code) {
    const data = exportData?.data || exportData;
    const roots = [
      data?.stocks,
      data?.countries,
      data?.data?.stocks,
      data?.data?.countries,
      data
    ].filter(Boolean);

    for (const root of roots) {
      const countryPayload = findCountryPayload(root, code);
      if (!countryPayload) continue;

      const items = Array.isArray(countryPayload)
        ? countryPayload
        : countryPayload.stocks || countryPayload.items || countryPayload.data || countryPayload.rows || [];

      const xanax = Array.isArray(items) ? items.find(isXanaxRow) : null;
      const update = updateFrom(xanax || {}, countryPayload, exportData);

      if (!xanax) {
        return {
          found: false,
          quantity: 0,
          cost: 0,
          update,
          raw: countryPayload
        };
      }

      return {
        found: true,
        quantity: stockQtyFrom(xanax),
        cost: priceFrom(xanax),
        update,
        raw: xanax
      };
    }

    return null;
  }

  function likelyItemArray(arr) {
    if (!Array.isArray(arr) || !arr.length) return false;
    return arr.some((row) => row && typeof row === 'object' && (
      isXanaxRow(row) ||
      row.itemName || row.item_name || row.overseasPrice || row.overseas_price ||
      row.countryName || row.country_code || row.stock !== undefined || row.quantity !== undefined
    ));
  }

  function gatherArrays(value, out = [], depth = 0) {
    if (!value || depth > 4) return out;

    if (Array.isArray(value)) {
      if (likelyItemArray(value)) out.push(value);
      value.slice(0, 25).forEach((child) => gatherArrays(child, out, depth + 1));
      return out;
    }

    if (typeof value !== 'object') return out;

    ['items', 'stocks', 'rows', 'results', 'data', 'countries', 'export', 'travel'].forEach((key) => {
      if (value[key]) gatherArrays(value[key], out, depth + 1);
    });

    return out;
  }

  function extractFromFlatRows(exportData, code) {
    const arrays = gatherArrays(exportData);
    for (const arr of arrays) {
      const row = arr.find((candidate) => isXanaxRow(candidate) && rowMatchesCountry(candidate, code));
      if (!row) continue;

      return {
        found: true,
        quantity: stockQtyFrom(row),
        cost: priceFrom(row),
        update: updateFrom(row, null, exportData),
        raw: row
      };
    }
    return null;
  }

  function extractXanax(exportData, code) {
    const fromCountry = extractFromCountryPayload(exportData, code);
    if (fromCountry) return fromCountry;

    const fromFlat = extractFromFlatRows(exportData, code);
    if (fromFlat) return fromFlat;

    return {
      found: false,
      quantity: 0,
      cost: 0,
      update: firstTimestamp(
        exportData?.generatedAt,
        exportData?.updatedAt,
        exportData?.lastUpdated,
        exportData?.timestamp,
        exportData?.update,
        exportData?.data?.generatedAt,
        exportData?.data?.updatedAt,
        exportData?.data?.lastUpdated,
        exportData?.data?.timestamp,
        exportData?.data?.update
      ),
      raw: null
    };
  }

  function matchCountryFromText(text) {
    const t = normalize(text);
    if (!t) return null;
    if (/\btorn\b|returning|home/.test(t)) return 'torn';

    for (const [code, aliases] of Object.entries(COUNTRY_ALIASES)) {
      if (aliases.some((a) => t === a || t.includes(a))) return code;
    }
    return null;
  }

  function flightMinutes(code) {
    const mode = String(getCfg('flightMode'));
    const book = Boolean(getCfg('bookActive'));
    const meta = COUNTRIES[code];
    const table = book ? meta.bookTimes : meta.times;
    return table[mode] ?? table.airstrip;
  }

  function parseArrivalTimestamp(rawTravel) {
    const candidates = [
      rawTravel?.timestamp,
      rawTravel?.arrival,
      rawTravel?.arrive,
      rawTravel?.arrives,
      rawTravel?.arrived,
      rawTravel?.landed,
      rawTravel?.landing,
      rawTravel?.time_left
    ].map(Number).filter(Number.isFinite);

    for (const value of candidates) {
      // Torn timestamps are usually epoch seconds. If a field is duration seconds, it is usually small.
      if (value > 1000000000) return value;
      if (value > 0 && value < 604800) return nowSec() + value;
    }
    return null;
  }

  function parseTravelStatus(apiData) {
    const status = apiData?.status || {};
    const travel = apiData?.travel || {};
    const statusDesc = status.description || status.details || status.state || '';
    const statusState = status.state || '';

    const rawText = [
      statusDesc,
      statusState,
      travel.destination,
      travel.location,
      travel.country,
      travel.departure,
      travel.direction,
      travel.status
    ].filter(Boolean).join(' | ');

    const arrivalTs = parseArrivalTimestamp(travel);
    const timeLeftSec = arrivalTs && arrivalTs > nowSec() ? arrivalTs - nowSec() : null;
    const text = normalize(rawText);

    let dest = matchCountryFromText(travel.destination || travel.location || travel.country || '');
    if (!dest) dest = matchCountryFromText(statusDesc);
    if (!dest) dest = matchCountryFromText(rawText);

    const flyingWords = /(flying|flight|travelling|traveling|en route|on your way|returning)/i.test(rawText);
    const returning = /(returning|back to torn|to torn|heading home|travelling to torn|traveling to torn)/i.test(rawText) || dest === 'torn';
    const abroadWords = /(abroad|in japan|in united kingdom|in uk|in south africa|tokyo|london|johannesburg)/i.test(rawText);

    if (flyingWords || timeLeftSec) {
      if (returning) {
        return {
          mode: 'returning',
          destinationCode: 'torn',
          destinationLabel: 'Torn',
          headline: 'Returning to Torn',
          detail: timeLeftSec ? `Landing in ${secondsToText(timeLeftSec)}` : 'In flight home',
          arrivalTs,
          timeLeftSec,
          rawText
        };
      }

      if (dest && COUNTRIES[dest]) {
        return {
          mode: 'outbound',
          destinationCode: dest,
          destinationLabel: COUNTRIES[dest].short,
          headline: `Flying to ${COUNTRIES[dest].short}`,
          detail: timeLeftSec ? `Landing in ${secondsToText(timeLeftSec)}` : 'In flight',
          arrivalTs,
          timeLeftSec,
          rawText
        };
      }

      return {
        mode: 'flying_unknown',
        destinationCode: null,
        destinationLabel: 'Unknown',
        headline: 'Flying',
        detail: timeLeftSec ? `Landing in ${secondsToText(timeLeftSec)}` : 'Destination unavailable',
        arrivalTs,
        timeLeftSec,
        rawText
      };
    }

    if (dest && COUNTRIES[dest] && abroadWords) {
      return {
        mode: 'abroad',
        destinationCode: dest,
        destinationLabel: COUNTRIES[dest].short,
        headline: `Abroad in ${COUNTRIES[dest].short}`,
        detail: 'Not currently flying',
        arrivalTs: null,
        timeLeftSec: null,
        rawText
      };
    }

    return {
      mode: 'torn',
      destinationCode: null,
      destinationLabel: 'Torn',
      headline: 'In Torn',
      detail: statusDesc || 'Ready to travel',
      arrivalTs: null,
      timeLeftSec: null,
      rawText
    };
  }

  function judge(row) {
    const desired = Number(getCfg('desiredQty')) || 1;
    const minStock = Number(getCfg('minStock')) || 1;
    const freshMins = Number(getCfg('freshMins')) || 20;
    const travel = state.travel;
    const isCurrentTarget = travel?.mode === 'outbound' && travel.destinationCode === row.code;
    const minutesToLanding = isCurrentTarget && travel?.timeLeftSec ? travel.timeLeftSec / 60 : row.flightWorstMins;

    if (!row.found) {
      return { label: 'No data', cls: 'bad', note: 'Stock source did not return Xanax for this country.' };
    }

    if (row.quantity <= 0) {
      return { label: 'No stock', cls: 'bad', note: 'Do not fly for Xanax unless you are gambling on a restock.' };
    }

    if (row.quantity < desired) {
      return { label: 'Too low', cls: 'bad', note: `Only ${row.quantity} shown, but target is ${desired}.` };
    }

    if (!row.update) {
      return { label: 'Unknown age', cls: 'warn', note: 'Stock exists, but the update timestamp is missing.' };
    }

    const ageAtLandingMins = row.ageMins + minutesToLanding;
    const hasBuffer = row.quantity >= Math.max(desired, minStock);

    if (isCurrentTarget) {
      if (ageAtLandingMins <= freshMins && hasBuffer) {
        return { label: 'Good landing odds', cls: 'good', note: 'Your current flight lands into fresh data with stock buffer.' };
      }
      if (ageAtLandingMins <= freshMins) {
        return { label: 'Thin landing', cls: 'warn', note: 'Your current flight lands into fresh data but low stock buffer.' };
      }
      return { label: 'Risky landing', cls: 'warn', note: 'Your current flight may land after the data is stale.' };
    }

    if (ageAtLandingMins <= freshMins && hasBuffer) {
      return { label: 'Best shot', cls: 'good', note: 'Fresh enough if you left now, with stock buffer.' };
    }

    if (ageAtLandingMins <= freshMins && !hasBuffer) {
      return { label: 'Fresh but thin', cls: 'warn', note: 'Fresh if you left now, but stock buffer is low.' };
    }

    if (ageAtLandingMins <= 60 && row.quantity >= Math.max(desired, minStock * 2)) {
      return { label: 'Decent gamble', cls: 'warn', note: 'Older by landing, but stock buffer is decent.' };
    }

    return { label: 'Risky', cls: 'warn', note: 'Stock may be stale by the time you land.' };
  }

  function buildRows(exportData) {
    return Object.keys(COUNTRIES).map((code) => {
      const meta = COUNTRIES[code];
      const stock = extractXanax(exportData, code);
      const fMins = flightMinutes(code);
      const isCurrentTarget = state.travel?.mode === 'outbound' && state.travel.destinationCode === code;
      const currentFlightMins = isCurrentTarget && state.travel.timeLeftSec ? state.travel.timeLeftSec / 60 : null;
      const ageMins = stock.update ? Math.max(0, (nowSec() - stock.update) / 60) : Infinity;
      const travelMins = currentFlightMins ?? fMins * 1.03;

      const row = {
        code,
        ...meta,
        ...stock,
        flightMins: fMins,
        flightWorstMins: fMins * 1.03,
        currentFlightMins,
        ageMins,
        eta: timeFromNow(travelMins),
        isCurrentTarget
      };

      row.judgement = judge(row);
      return row;
    });
  }

  async function getTornStatus() {
    const key = String(getCfg('apiKey') || '').trim();
    if (!key) return null;

    const url = `https://api.torn.com/user/?selections=profile,travel&key=${encodeURIComponent(key)}`;
    const data = await requestJson(url);

    if (data?.error) {
      throw new Error(data.error.error || data.error.message || 'Torn API error');
    }

    return data;
  }

  function travelCardHtml() {
    const hasKey = String(getCfg('apiKey') || '').trim().length > 0;
    if (!hasKey) {
      return `
        <section class="xfp-travel xfp-card">
          <div>
            <div class="xfp-eyebrow">Status</div>
            <div class="xfp-travel-title">API key missing</div>
            <div class="xfp-travel-note">Add key for flight direction.</div>
          </div>
          <button class="xfp-link-btn" id="xfp-open-settings-2">Key</button>
        </section>`;
    }

    if (!state.travel) {
      return `
        <section class="xfp-travel xfp-card">
          <div>
            <div class="xfp-eyebrow">Status</div>
            <div class="xfp-travel-title">Travel unavailable</div>
            <div class="xfp-travel-note">Torn API did not return travel data.</div>
          </div>
        </section>`;
    }

    const t = state.travel;
    const cls = t.mode === 'outbound' ? 'xfp-blue' : t.mode === 'returning' ? 'xfp-gray' : 'xfp-plain';
    const sub = t.mode === 'outbound'
      ? 'Target highlighted.'
      : t.mode === 'returning'
        ? 'Predictions are for next trip.'
        : t.mode === 'abroad'
          ? 'Confirm on item page.'
          : 'Assumes leaving now.';

    return `
      <section class="xfp-travel xfp-card ${cls}">
        <div>
          <div class="xfp-eyebrow">Status</div>
          <div class="xfp-travel-title">${esc(t.headline)}</div>
          <div class="xfp-travel-note">${esc(t.detail)} · ${esc(sub)}</div>
        </div>
      </section>`;
  }

  function compactRowsHtml(rows) {
    if (!rows.length) return '<div class="xfp-empty">Loading Xanax stock…</div>';

    return rows.map((row) => {
      const j = row.judgement;
      const ageText = Number.isFinite(row.ageMins) ? minsToText(row.ageMins) : 'unknown';
      const landingAge = Number.isFinite(row.ageMins)
        ? minsToText(row.ageMins + (row.currentFlightMins ?? row.flightWorstMins))
        : 'unknown';
      const flyText = row.currentFlightMins
        ? `land ${row.eta}`
        : `${minsToText(row.flightWorstMins)} → ${row.eta}`;
      const targetText = row.isCurrentTarget ? '<span class="xfp-target-dot">current flight</span>' : '';

      return `
        <article class="xfp-country-card ${row.isCurrentTarget ? 'xfp-target' : ''}">
          <div class="xfp-country-top">
            <div class="xfp-country-name">${esc(row.short)} ${targetText}</div>
            <span class="xfp-pill ${j.cls}" title="${esc(j.note)}">${esc(j.label)}</span>
          </div>
          <div class="xfp-line">
            <span><b>${row.quantity.toLocaleString()}</b> stock</span>
            <span>${money(row.cost)}</span>
            <span>${esc(flyText)}</span>
          </div>
          <div class="xfp-line xfp-muted-line">
            <span>data ${esc(ageText)}</span>
            <span>landing age ${esc(landingAge)}</span>
          </div>
        </article>`;
    }).join('');
  }

  function settingsHtml() {
    return `
      <section id="xfp-settings-box" class="xfp-settings" hidden>
        <label class="xfp-field xfp-span">
          <span>Public Torn API key</span>
          <input id="xfp-api-key" type="password" autocomplete="off" value="${esc(getCfg('apiKey'))}" placeholder="Paste public key here">
        </label>

        <label class="xfp-field">
          <span>Flight method</span>
          <select id="xfp-flight-mode">
            ${option('standard', 'Standard')}
            ${option('airstrip', 'PI Airstrip')}
            ${option('wlt', 'WLT Private')}
            ${option('business', 'Business Class')}
          </select>
        </label>

        <label class="xfp-field">
          <span>Desired Xanax qty</span>
          <input id="xfp-desired" type="number" min="1" value="${esc(getCfg('desiredQty'))}">
        </label>

        <label class="xfp-field">
          <span>Minimum safe stock</span>
          <input id="xfp-min-stock" type="number" min="1" value="${esc(getCfg('minStock'))}">
        </label>

        <label class="xfp-field">
          <span>Fresh data max minutes</span>
          <input id="xfp-fresh" type="number" min="1" value="${esc(getCfg('freshMins'))}">
        </label>

        <label class="xfp-field">
          <span>Auto-refresh minutes</span>
          <input id="xfp-auto" type="number" min="1" value="${esc(getCfg('autoMins'))}">
        </label>

        <label class="xfp-toggle">
          <input id="xfp-book" type="checkbox" ${getCfg('bookActive') ? 'checked' : ''}>
          <span>Mailing Yourself Abroad active</span>
        </label>

        <label class="xfp-toggle">
          <input id="xfp-compact" type="checkbox" ${getCfg('compact') ? 'checked' : ''}>
          <span>Compact mode</span>
        </label>

        <label class="xfp-toggle xfp-span">
          <input id="xfp-push" type="checkbox" ${getCfg('autoPushYata') ? 'checked' : ''}>
          <span>Auto-post visible abroad stock to YATA fallback</span>
        </label>

        <div class="xfp-settings-actions xfp-span">
          <button type="button" class="xfp-secondary" id="xfp-close-settings">Close</button>
          <button type="button" class="xfp-primary" id="xfp-save">Save</button>
        </div>
      </section>`;
  }

  function option(value, label) {
    return `<option value="${value}" ${getCfg('flightMode') === value ? 'selected' : ''}>${label}</option>`;
  }

  function getSavedPanelPosition() {
    try {
      const raw = localStorage.getItem(LS_PREFIX + 'panel_pos');
      if (!raw) return null;
      const pos = JSON.parse(raw);
      if (!Number.isFinite(pos?.left) || !Number.isFinite(pos?.top)) return null;
      return pos;
    } catch (_) {
      return null;
    }
  }

  function savePanelPosition(left, top) {
    localStorage.setItem(LS_PREFIX + 'panel_pos', JSON.stringify({ left: Math.round(left), top: Math.round(top) }));
  }

  function clampPanelPosition(left, top) {
    const panel = document.getElementById('xfp-panel');
    if (!panel) return { left, top };
    const rect = panel.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    return {
      left: Math.min(Math.max(left, margin), maxLeft),
      top: Math.min(Math.max(top, margin), maxTop)
    };
  }

  function applyPanelPosition() {
    const panel = document.getElementById('xfp-panel');
    if (!panel) return;
    const saved = getSavedPanelPosition();
    if (!saved) return;

    const pos = clampPanelPosition(saved.left, saved.top);
    panel.style.left = pos.left + 'px';
    panel.style.top = pos.top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';
  }

  function bindPanelDrag() {
    const panel = document.getElementById('xfp-panel');
    const handle = document.getElementById('xfp-drag-handle');
    if (!panel || !handle || handle.dataset.dragReady === '1') return;
    handle.dataset.dragReady = '1';

    handle.addEventListener('pointerdown', (event) => {
      if (event.target.closest('input, select, textarea, #xfp-refresh, #xfp-settings, #xfp-save, #xfp-close-settings, #xfp-open-settings-2')) return;

      const rect = panel.getBoundingClientRect();
      dragInfo = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
        moved: false
      };

      panel.style.left = rect.left + 'px';
      panel.style.top = rect.top + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.transform = 'none';
      handle.setPointerCapture?.(event.pointerId);
    });

    handle.addEventListener('pointermove', (event) => {
      if (!dragInfo || dragInfo.pointerId !== event.pointerId) return;
      const dx = event.clientX - dragInfo.startX;
      const dy = event.clientY - dragInfo.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) dragInfo.moved = true;
      const pos = clampPanelPosition(dragInfo.left + dx, dragInfo.top + dy);
      panel.style.left = pos.left + 'px';
      panel.style.top = pos.top + 'px';
    });

    handle.addEventListener('pointerup', (event) => {
      if (!dragInfo || dragInfo.pointerId !== event.pointerId) return;
      const rect = panel.getBoundingClientRect();
      const moved = dragInfo.moved;
      dragInfo = null;
      savePanelPosition(rect.left, rect.top);
      if (moved) suppressCollapseClickUntil = Date.now() + 250;
      handle.releasePointerCapture?.(event.pointerId);
    });

    handle.addEventListener('pointercancel', () => {
      dragInfo = null;
    });
  }

  function render(error = '') {
    const panel = document.getElementById('xfp-panel');
    if (!panel) return;

    const collapsed = Boolean(getCfg('collapsed'));
    const compact = Boolean(getCfg('compact'));
    panel.classList.toggle('xfp-collapsed', collapsed);
    panel.classList.toggle('xfp-compact', compact);

    const last = state.lastRefresh
      ? state.lastRefresh.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : 'never';
    const sourceBase = state.dataProvider || 'DroqsDB';
    const sourceState = state.dataSource === 'cache' ? 'cached' : 'live';
    const sourceMode = state.sourceMeta?.servingMode && state.sourceMeta.servingMode !== 'live'
      ? ` · ${state.sourceMeta.servingMode}`
      : '';
    const sourceLabel = `${sourceBase} ${sourceState}${sourceMode}`;

    const mode = getCfg('flightMode');
    const book = Boolean(getCfg('bookActive'));

    panel.innerHTML = `
      <header class="xfp-header" id="xfp-drag-handle">
        <button type="button" class="xfp-title-button" id="xfp-collapse" title="Collapse / expand">
          <span class="xfp-icon"><img src="${XANAX_ICON_DATA}" alt="Xanax"></span>
          <span>
            <strong>${SCRIPT_NAME}</strong>
            <small>${esc(mode)}${book ? ' + book' : ''} · ${esc(sourceLabel)} · ${esc(last)}</small>
          </span>
        </button>

        <div class="xfp-actions">
          <button type="button" class="xfp-secondary" id="xfp-refresh">Refresh</button>
          <button type="button" class="xfp-round" id="xfp-settings" title="Settings">⌘</button>
        </div>
      </header>

      <main class="xfp-body" ${collapsed ? 'hidden' : ''}>
        ${error || state.error ? `<div class="xfp-error">${esc(error || state.error)}</div>` : ''}
        ${state.warning ? `<div class="xfp-warning">${esc(state.warning)}</div>` : ''}
        ${travelCardHtml()}
        <section class="xfp-stock-list">${compactRowsHtml(state.rows)}</section>
        <p class="xfp-foot">DroqsDB first · YATA/cache fallback.</p>
      </main>

      ${settingsHtml()}`;

    bindEvents();
    applyPanelPosition();
  }

  function bindEvents() {
    const byId = (id) => document.getElementById(id);

    byId('xfp-refresh')?.addEventListener('click', () => refreshAll(true));
    byId('xfp-collapse')?.addEventListener('click', () => {
      if (Date.now() < suppressCollapseClickUntil) return;
      setCfg('collapsed', !Boolean(getCfg('collapsed')));
      render();
    });

    const toggleSettings = () => {
      const box = byId('xfp-settings-box');
      if (box) box.hidden = !box.hidden;
    };

    byId('xfp-settings')?.addEventListener('click', toggleSettings);
    byId('xfp-open-settings-2')?.addEventListener('click', toggleSettings);
    byId('xfp-close-settings')?.addEventListener('click', () => {
      const box = byId('xfp-settings-box');
      if (box) box.hidden = true;
    });

    byId('xfp-save')?.addEventListener('click', () => {
      setCfg('apiKey', byId('xfp-api-key')?.value.trim() || '');
      setCfg('flightMode', byId('xfp-flight-mode')?.value || 'airstrip');
      setCfg('bookActive', Boolean(byId('xfp-book')?.checked));
      setCfg('desiredQty', Math.max(1, Number(byId('xfp-desired')?.value || 1)));
      setCfg('minStock', Math.max(1, Number(byId('xfp-min-stock')?.value || 50)));
      setCfg('freshMins', Math.max(1, Number(byId('xfp-fresh')?.value || 20)));
      setCfg('autoMins', Math.max(1, Number(byId('xfp-auto')?.value || 2)));
      setCfg('autoPushYata', Boolean(byId('xfp-push')?.checked));
      setCfg('compact', Boolean(byId('xfp-compact')?.checked));

      scheduleAutoRefresh();
      refreshAll(true);
    });

    bindPanelDrag();
  }

  async function refreshAll(force = false) {
    if (state.busy && !force) return;

    state.busy = true;
    state.error = '';
    state.warning = '';
    render();

    try {
      const [tornResult, yataResult] = await Promise.allSettled([
        getTornStatus(),
        getTravelStock(force)
      ]);

      if (tornResult.status === 'fulfilled') {
        state.torn = tornResult.value;
        state.travel = state.torn ? parseTravelStatus(state.torn) : null;
      } else {
        state.torn = null;
        state.travel = null;
        state.warning = 'Torn API unavailable. ' + normalizeError(tornResult.reason);
      }

      if (yataResult.status === 'fulfilled') {
        const result = yataResult.value;
        state.yata = result.data;
        state.rows = buildRows(state.yata);
        state.dataSource = result.fromCache ? 'cache' : 'live';
        state.dataProvider = result.provider || 'Unknown';
        state.sourceMeta = result.meta || null;
        state.lastRefresh = new Date(result.cacheAt || Date.now());
        if (result.warning) {
          state.warning = state.warning ? state.warning + ' · ' + result.warning : result.warning;
        }
      } else {
        throw yataResult.reason;
      }

      render();
      tryAutoPushYata();
    } catch (err) {
      state.error = normalizeError(err);
      if (state.rows && state.rows.length) {
        state.warning = state.error + '. Keeping the last stock shown on screen.';
        state.error = '';
      }
      render(state.error);
    } finally {
      state.busy = false;
    }
  }

  function scheduleAutoRefresh() {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    const mins = Math.max(1, Number(getCfg('autoMins')) || 2);
    state.refreshTimer = setInterval(() => refreshAll(false), mins * 60 * 1000);
  }

  function detectAbroadCountryFromDom() {
    const chunks = [];
    chunks.push(document.title || '');
    document.querySelectorAll('.content-title, .title-black, .msg, .info-msg, h1, h2, h3, h4, h5').forEach((el) => {
      if (el && el.textContent) chunks.push(el.textContent);
    });
    return matchCountryFromText(chunks.join(' | '));
  }

  function collectVisibleAbroadItems() {
    const items = [];
    const seen = new Set();

    const nodes = document.querySelectorAll('[itemid], [data-itemid], [data-item-id]');
    nodes.forEach((node) => {
      const id = Number(node.getAttribute('itemid') || node.getAttribute('data-itemid') || node.getAttribute('data-item-id'));
      if (!Number.isFinite(id) || seen.has(id)) return;

      const itemRoot = node.closest('li, .item-wrap, .item, .users-list > div, [class*="item"]') || node.parentElement;
      if (!itemRoot) return;

      const text = itemRoot.textContent || '';
      const priceText = itemRoot.querySelector('.cost .c-price, .c-price, [class*="price"], [class*="cost"]')?.textContent || text;
      const stockText = itemRoot.querySelector('.stock .stck-amount, .stck-amount, [class*="stock"]')?.textContent || text;

      const cost = Number(String(priceText).match(/\$?([0-9][0-9,]+)/)?.[1]?.replace(/,/g, '') || 0);
      const stockMatches = String(stockText).match(/stock[^0-9]*([0-9][0-9,]*)/i);
      const quantity = Number((stockMatches?.[1] || '').replace(/,/g, '')) || 0;

      if (cost || quantity) {
        seen.add(id);
        items.push({ id, cost, quantity });
      }
    });

    return items;
  }

  async function tryAutoPushYata() {
    if (!getCfg('autoPushYata')) return;

    const code = detectAbroadCountryFromDom();
    if (!code || code === 'torn') return;

    const lastKey = LS_PREFIX + 'last_push_' + code;
    const lastPush = Number(localStorage.getItem(lastKey) || 0);
    if (Date.now() - lastPush < 5 * 60 * 1000) return;

    const items = collectVisibleAbroadItems();
    if (!items.length) return;

    const payload = {
      country: code,
      client: SCRIPT_NAME,
      version: SCRIPT_VERSION,
      author_name: state.torn?.name || 'Torn user',
      author_id: state.torn?.player_id || 0,
      items
    };

    try {
      await requestJson(YATA_IMPORT, 'POST', payload);
      localStorage.setItem(lastKey, String(Date.now()));
      console.info(`[${SCRIPT_NAME}] Posted ${items.length} abroad stock rows to YATA for ${code}.`);
    } catch (err) {
      console.warn(`[${SCRIPT_NAME}] YATA import failed:`, err);
    }
  }

  function createPanel() {
    if (document.getElementById('xfp-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'xfp-panel';
    document.body.appendChild(panel);
    render();
  }

  addStyle(`
    #xfp-panel,
    #xfp-panel * {
      box-sizing: border-box;
    }

    #xfp-panel {
      --xfp-blue: #0066cc;
      --xfp-blue-focus: #0071e3;
      --xfp-ink: #1d1d1f;
      --xfp-muted: #6e6e73;
      --xfp-hairline: #e0e0e0;
      --xfp-parchment: #f5f5f7;
      --xfp-pearl: #fafafc;
      --xfp-white: #ffffff;

      position: fixed;
      right: 12px;
      top: 50%;
      bottom: auto;
      transform: translateY(-50%);
      width: 340px;
      max-width: calc(100vw - 16px);
      max-height: calc(100vh - 24px);
      z-index: 2147483647;
      overflow: auto;
      background: rgba(245, 245, 247, 0.9);
      -webkit-backdrop-filter: saturate(180%) blur(20px);
      backdrop-filter: saturate(180%) blur(20px);
      color: var(--xfp-ink);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 18px;
      font-family: SF Pro Text, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
      font-size: 12px;
      line-height: 1.28;
      letter-spacing: -0.12px;
      touch-action: none;
    }

    #xfp-panel button,
    #xfp-panel input,
    #xfp-panel select {
      font: inherit;
    }

    #xfp-panel button {
      cursor: pointer;
      border: 0;
      transition: transform 120ms ease, background-color 120ms ease, border-color 120ms ease;
    }

    #xfp-panel button:active {
      transform: scale(0.95);
    }

    #xfp-panel button:focus-visible,
    #xfp-panel input:focus-visible,
    #xfp-panel select:focus-visible {
      outline: 2px solid var(--xfp-blue-focus);
      outline-offset: 2px;
    }

    .xfp-header {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 48px;
      padding: 8px 9px;
      background: rgba(245, 245, 247, 0.86);
      -webkit-backdrop-filter: saturate(180%) blur(20px);
      backdrop-filter: saturate(180%) blur(20px);
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      cursor: grab;
      user-select: none;
    }

    .xfp-header:active {
      cursor: grabbing;
    }

    .xfp-title-button {
      display: flex;
      align-items: center;
      gap: 8px;
      background: transparent;
      color: var(--xfp-ink);
      text-align: left;
      min-width: 0;
      padding: 0;
      flex: 1 1 auto;
    }

    .xfp-title-button strong {
      display: block;
      font-family: SF Pro Display, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.1;
      letter-spacing: -0.224px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 190px;
    }

    .xfp-title-button small {
      display: block;
      color: var(--xfp-muted);
      font-size: 10px;
      line-height: 1.15;
      letter-spacing: -0.08px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 210px;
    }

    .xfp-icon {
      display: grid;
      place-items: center;
      width: 42px;
      height: 26px;
      border-radius: 9999px;
      background: var(--xfp-white);
      border: 1px solid rgba(0, 0, 0, 0.08);
      flex: 0 0 auto;
      overflow: hidden;
    }

    .xfp-icon img {
      display: block;
      width: 56px;
      height: auto;
      transform: rotate(-3deg);
      pointer-events: none;
    }

    .xfp-actions {
      display: flex;
      align-items: center;
      gap: 5px;
      flex: 0 0 auto;
    }

    .xfp-primary,
    .xfp-secondary,
    .xfp-link-btn {
      min-height: 28px;
      border-radius: 9999px;
      padding: 6px 10px;
      white-space: nowrap;
    }

    .xfp-primary {
      background: var(--xfp-blue);
      color: #fff;
    }

    .xfp-secondary,
    .xfp-link-btn {
      background: var(--xfp-white);
      color: var(--xfp-blue);
      border: 1px solid rgba(0, 102, 204, 0.2) !important;
    }

    .xfp-round {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 9999px;
      background: var(--xfp-white);
      color: var(--xfp-ink);
      border: 1px solid rgba(0, 0, 0, 0.08) !important;
      font-weight: 600;
    }

    .xfp-body {
      padding: 8px;
    }

    .xfp-card,
    .xfp-country-card,
    .xfp-settings {
      background: var(--xfp-white);
      border: 1px solid var(--xfp-hairline);
      border-radius: 14px;
    }

    .xfp-travel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 9px 10px;
      margin-bottom: 7px;
    }

    .xfp-travel.xfp-blue {
      border-color: rgba(0, 102, 204, 0.42);
    }

    .xfp-eyebrow {
      color: var(--xfp-muted);
      font-size: 10px;
      line-height: 1.1;
      margin-bottom: 1px;
    }

    .xfp-travel-title {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.15;
      color: var(--xfp-ink);
    }

    .xfp-travel-note {
      color: var(--xfp-muted);
      margin-top: 2px;
      font-size: 11px;
      line-height: 1.2;
    }

    .xfp-error,
    .xfp-warning {
      margin-bottom: 7px;
      padding: 8px 9px;
      border-radius: 14px;
      font-size: 11px;
      line-height: 1.25;
    }

    .xfp-error {
      background: #fff2f2;
      border: 1px solid #ffd4d4;
      color: #8a1f1f;
    }

    .xfp-warning {
      background: #fff8e8;
      border: 1px solid #f3d28a;
      color: #7a5200;
    }

    .xfp-stock-list {
      display: grid;
      gap: 6px;
    }

    .xfp-country-card {
      padding: 8px 9px;
    }

    .xfp-country-card.xfp-target {
      border-color: rgba(0, 102, 204, 0.58);
      box-shadow: inset 0 0 0 1px rgba(0, 102, 204, 0.12);
    }

    .xfp-country-top {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
      margin-bottom: 5px;
    }

    .xfp-country-name {
      font-size: 13px;
      font-weight: 600;
      line-height: 1.15;
      color: var(--xfp-ink);
      min-width: 0;
    }

    .xfp-target-dot {
      display: inline-flex;
      margin-left: 4px;
      color: var(--xfp-blue);
      font-size: 10px;
      font-weight: 400;
    }

    .xfp-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 22px;
      padding: 4px 8px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 600;
      line-height: 1;
      white-space: nowrap;
    }

    .xfp-pill.good {
      background: var(--xfp-blue);
      color: #fff;
    }

    .xfp-pill.warn {
      background: #fff7e6;
      color: #815600;
      border: 1px solid #f0d79a;
    }

    .xfp-pill.bad {
      background: #fff2f2;
      color: #9b1c1c;
      border: 1px solid #ffd0d0;
    }

    .xfp-line {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      color: var(--xfp-ink);
      font-size: 11px;
      line-height: 1.2;
    }

    .xfp-line b {
      font-weight: 600;
    }

    .xfp-muted-line,
    .xfp-foot,
    .xfp-empty {
      color: var(--xfp-muted);
    }

    .xfp-foot,
    .xfp-empty {
      font-size: 10px;
      line-height: 1.2;
      margin: 7px 2px 0;
    }

    .xfp-settings {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 9px;
      margin: 0 8px 8px;
    }

    .xfp-settings[hidden] {
      display: none !important;
    }

    .xfp-field,
    .xfp-toggle {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      color: var(--xfp-muted);
      font-size: 10px;
      line-height: 1.1;
    }

    .xfp-toggle {
      flex-direction: row;
      align-items: center;
      gap: 6px;
      padding: 4px 0;
    }

    .xfp-toggle input {
      width: 15px;
      height: 15px;
      accent-color: var(--xfp-blue);
    }

    .xfp-span {
      grid-column: 1 / -1;
    }

    .xfp-field input,
    .xfp-field select {
      width: 100%;
      height: 34px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 9999px;
      background: var(--xfp-white);
      color: var(--xfp-ink);
      padding: 8px 11px;
      font-size: 12px;
    }

    .xfp-settings-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }

    #xfp-panel.xfp-collapsed {
      width: 66px;
      height: 42px;
      min-width: 66px;
      overflow: visible;
      background: transparent;
      border-color: transparent;
      border-radius: 9999px;
    }

    #xfp-panel.xfp-collapsed .xfp-header {
      position: static;
      min-height: 42px;
      width: 66px;
      padding: 0;
      border: 0;
      border-radius: 9999px;
      background: rgba(250, 250, 252, 0.92);
      box-shadow: 0 2px 10px rgba(0,0,0,0.14);
      justify-content: center;
    }

    #xfp-panel.xfp-collapsed .xfp-actions,
    #xfp-panel.xfp-collapsed .xfp-title-button strong,
    #xfp-panel.xfp-collapsed .xfp-title-button small {
      display: none;
    }

    #xfp-panel.xfp-collapsed .xfp-title-button {
      justify-content: center;
      width: 66px;
      height: 42px;
      flex: 0 0 auto;
    }

    #xfp-panel.xfp-collapsed .xfp-icon {
      width: 62px;
      height: 38px;
      border: 0;
      background: transparent;
    }

    #xfp-panel.xfp-collapsed .xfp-icon img {
      width: 82px;
    }

    #xfp-panel.xfp-compact {
      width: 320px;
    }

    @media (max-width: 760px) {
      #xfp-panel {
        right: 6px;
        width: min(310px, calc(100vw - 12px));
        max-height: calc(100vh - 14px);
        font-size: 11px;
      }

      .xfp-header {
        min-height: 44px;
        padding: 7px;
      }

      .xfp-title-button strong {
        font-size: 13px;
        max-width: 150px;
      }

      .xfp-title-button small {
        max-width: 170px;
      }

      .xfp-secondary {
        padding: 5px 8px;
      }

      .xfp-round {
        width: 26px;
        height: 26px;
      }

      .xfp-body {
        padding: 6px;
      }

      .xfp-travel,
      .xfp-country-card {
        padding: 7px;
      }

      .xfp-settings {
        grid-template-columns: 1fr;
        margin: 0 6px 6px;
        padding: 8px;
      }
    }

    @media (max-height: 620px) {
      #xfp-panel {
        top: 8px;
        transform: none;
      }
    }
  `);

  runV6Migration();
  createPanel();
  refreshAll(true);
  scheduleAutoRefresh();
})();
