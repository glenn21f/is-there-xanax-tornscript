// ==UserScript==
// @name         Is there Xanax ?
// @namespace    glenn.torn.is.there.xanax
// @version      0.5.1
// @description  Apple-style DroqsDB-first Xanax travel planner with YATA fallback, cached stock, Torn API flight direction detection, and Torn PDA compatibility.
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
  const SCRIPT_VERSION = '0.5.1';
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
    collapsed: false,
    compact: false
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

  function getCfg(key) {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw === null || raw === undefined) return DEFAULTS[key];
    try { return JSON.parse(raw); } catch (_) { return raw; }
  }

  function setCfg(key, value) {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
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
            <div class="xfp-eyebrow">Torn API</div>
            <div class="xfp-travel-title">API key not set</div>
            <div class="xfp-travel-note">Stock works. Flight direction needs your public API key.</div>
          </div>
          <button class="xfp-link-btn" id="xfp-open-settings-2">Add key</button>
        </section>`;
    }

    if (!state.travel) {
      return `
        <section class="xfp-travel xfp-card">
          <div>
            <div class="xfp-eyebrow">Travel status</div>
            <div class="xfp-travel-title">Unavailable</div>
            <div class="xfp-travel-note">The Torn API did not return travel data.</div>
          </div>
        </section>`;
    }

    const t = state.travel;
    const cls = t.mode === 'outbound' ? 'xfp-blue' : t.mode === 'returning' ? 'xfp-gray' : 'xfp-plain';
    const sub = t.mode === 'outbound'
      ? 'Current flight target is highlighted below.'
      : t.mode === 'returning'
        ? 'You are flying home. Stock predictions are for your next outbound trip.'
        : t.mode === 'abroad'
          ? 'You are abroad. Buy if the local item page confirms stock.'
          : 'Not currently flying. Predictions assume you leave now.';

    return `
      <section class="xfp-travel xfp-card ${cls}">
        <div>
          <div class="xfp-eyebrow">Travel status</div>
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
        ? `your flight · lands ${row.eta}`
        : `${minsToText(row.flightWorstMins)} · ETA ${row.eta}`;

      return `
        <article class="xfp-country-card ${row.isCurrentTarget ? 'xfp-target' : ''}">
          <div class="xfp-country-top">
            <div>
              <div class="xfp-country-name">${esc(row.short)}</div>
              <div class="xfp-country-city">${esc(row.city)}</div>
            </div>
            <span class="xfp-pill ${j.cls}">${esc(j.label)}</span>
          </div>

          <div class="xfp-metrics">
            <div><span>Stock</span><strong>${row.quantity.toLocaleString()}</strong></div>
            <div><span>Price</span><strong>${money(row.cost)}</strong></div>
            <div><span>Land</span><strong>${esc(flyText)}</strong></div>
            <div><span>Data</span><strong>${esc(ageText)} now · ${esc(landingAge)} landing</strong></div>
          </div>

          <p>${esc(j.note)}</p>
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
      <header class="xfp-header">
        <button type="button" class="xfp-title-button" id="xfp-collapse" title="Collapse / expand">
          <span class="xfp-icon">💊</span>
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
        <p class="xfp-foot">DroqsDB is primary. YATA is fallback. Cached stock is clearly marked when live data fails.</p>
      </main>

      ${settingsHtml()}`;

    bindEvents();
  }

  function bindEvents() {
    const byId = (id) => document.getElementById(id);

    byId('xfp-refresh')?.addEventListener('click', () => refreshAll(true));
    byId('xfp-collapse')?.addEventListener('click', () => {
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
      --xfp-blue-dark: #2997ff;
      --xfp-ink: #1d1d1f;
      --xfp-muted: #7a7a7a;
      --xfp-muted-2: #333333;
      --xfp-hairline: #e0e0e0;
      --xfp-parchment: #f5f5f7;
      --xfp-pearl: #fafafc;
      --xfp-white: #ffffff;
      --xfp-dark: #272729;

      position: fixed;
      right: 16px;
      top: 50%;
      bottom: auto;
      transform: translateY(-50%);
      width: 470px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 88px);
      z-index: 2147483647;
      overflow: auto;
      background: rgba(245, 245, 247, 0.88);
      -webkit-backdrop-filter: saturate(180%) blur(20px);
      backdrop-filter: saturate(180%) blur(20px);
      color: var(--xfp-ink);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 18px;
      font-family: SF Pro Text, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
      font-size: 14px;
      line-height: 1.43;
      letter-spacing: -0.224px;
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
      gap: 12px;
      min-height: 64px;
      padding: 12px 14px;
      background: rgba(245, 245, 247, 0.82);
      -webkit-backdrop-filter: saturate(180%) blur(20px);
      backdrop-filter: saturate(180%) blur(20px);
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .xfp-title-button {
      display: flex;
      align-items: center;
      gap: 10px;
      background: transparent;
      color: var(--xfp-ink);
      text-align: left;
      min-width: 0;
      padding: 0;
    }

    .xfp-title-button strong {
      display: block;
      font-family: SF Pro Display, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
      font-size: 17px;
      font-weight: 600;
      line-height: 1.2;
      letter-spacing: -0.374px;
      white-space: nowrap;
    }

    .xfp-title-button small {
      display: block;
      color: var(--xfp-muted);
      font-size: 12px;
      line-height: 1.2;
      letter-spacing: -0.12px;
      white-space: nowrap;
    }

    .xfp-icon {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 9999px;
      background: var(--xfp-white);
      border: 1px solid rgba(0, 0, 0, 0.08);
      flex: 0 0 auto;
    }

    .xfp-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }

    .xfp-primary,
    .xfp-secondary,
    .xfp-link-btn {
      min-height: 34px;
      border-radius: 9999px;
      padding: 8px 15px;
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
      border: 1px solid rgba(0, 102, 204, 0.22) !important;
    }

    .xfp-round {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 9999px;
      background: var(--xfp-white);
      color: var(--xfp-ink);
      border: 1px solid rgba(0, 0, 0, 0.08) !important;
      font-weight: 600;
    }

    .xfp-body {
      padding: 14px;
    }

    .xfp-card,
    .xfp-country-card,
    .xfp-settings {
      background: var(--xfp-white);
      border: 1px solid var(--xfp-hairline);
      border-radius: 18px;
    }

    .xfp-travel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px;
      margin-bottom: 12px;
    }

    .xfp-travel.xfp-blue {
      background: #ffffff;
      border-color: rgba(0, 102, 204, 0.36);
    }

    .xfp-travel.xfp-gray {
      background: var(--xfp-pearl);
    }

    .xfp-eyebrow {
      color: var(--xfp-muted);
      font-size: 12px;
      letter-spacing: -0.12px;
      line-height: 1.2;
      margin-bottom: 2px;
    }

    .xfp-travel-title {
      font-family: SF Pro Display, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
      font-size: 21px;
      font-weight: 600;
      line-height: 1.19;
      letter-spacing: 0.231px;
      color: var(--xfp-ink);
    }

    .xfp-travel-note {
      color: var(--xfp-muted-2);
      margin-top: 4px;
      font-size: 13px;
      line-height: 1.35;
    }

    .xfp-error {
      margin-bottom: 12px;
      padding: 12px 14px;
      background: #fff2f2;
      border: 1px solid #ffd4d4;
      border-radius: 18px;
      color: #8a1f1f;
    }

    .xfp-warning {
      margin-bottom: 12px;
      padding: 12px 14px;
      background: #fff8e8;
      border: 1px solid #f3d28a;
      border-radius: 18px;
      color: #7a5200;
    }

    .xfp-stock-list {
      display: grid;
      gap: 10px;
    }

    .xfp-country-card {
      padding: 14px;
    }

    .xfp-country-card.xfp-target {
      border-color: rgba(0, 102, 204, 0.55);
      box-shadow: inset 0 0 0 1px rgba(0, 102, 204, 0.12);
    }

    .xfp-country-top {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: flex-start;
      margin-bottom: 10px;
    }

    .xfp-country-name {
      font-size: 17px;
      font-weight: 600;
      line-height: 1.24;
      letter-spacing: -0.374px;
      color: var(--xfp-ink);
    }

    .xfp-country-city {
      color: var(--xfp-muted);
      font-size: 12px;
      line-height: 1.3;
      margin-top: 1px;
    }

    .xfp-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 6px 11px;
      border-radius: 9999px;
      font-size: 12px;
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

    .xfp-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .xfp-metrics div {
      min-width: 0;
      padding: 10px 12px;
      background: var(--xfp-parchment);
      border-radius: 14px;
    }

    .xfp-metrics span {
      display: block;
      color: var(--xfp-muted);
      font-size: 11px;
      line-height: 1.15;
      margin-bottom: 3px;
    }

    .xfp-metrics strong {
      display: block;
      color: var(--xfp-ink);
      font-size: 13px;
      font-weight: 600;
      line-height: 1.25;
      word-break: break-word;
    }

    .xfp-country-card p,
    .xfp-foot,
    .xfp-empty {
      color: var(--xfp-muted);
      font-size: 12px;
      line-height: 1.35;
      margin: 10px 0 0;
    }

    .xfp-settings {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      padding: 14px;
      margin: 0 14px 14px;
    }

    .xfp-settings[hidden] {
      display: none !important;
    }

    .xfp-field,
    .xfp-toggle {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      color: var(--xfp-muted-2);
      font-size: 12px;
      line-height: 1.2;
    }

    .xfp-toggle {
      flex-direction: row;
      align-items: center;
      gap: 9px;
      padding: 8px 0;
    }

    .xfp-toggle input {
      width: 18px;
      height: 18px;
      accent-color: var(--xfp-blue);
    }

    .xfp-span {
      grid-column: 1 / -1;
    }

    .xfp-field input,
    .xfp-field select {
      width: 100%;
      height: 44px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 9999px;
      background: var(--xfp-white);
      color: var(--xfp-ink);
      padding: 12px 16px;
      font-size: 14px;
    }

    .xfp-settings-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    #xfp-panel.xfp-collapsed {
      width: auto;
      overflow: visible;
    }

    #xfp-panel.xfp-collapsed .xfp-header {
      border-bottom: 0;
      min-height: 56px;
      border-radius: 18px;
    }

    #xfp-panel.xfp-collapsed .xfp-actions {
      display: none;
    }

    #xfp-panel.xfp-collapsed .xfp-title-button small {
      display: none;
    }

    #xfp-panel.xfp-compact {
      width: 390px;
    }

    #xfp-panel.xfp-compact .xfp-travel-title {
      font-size: 17px;
    }

    #xfp-panel.xfp-compact .xfp-metrics {
      grid-template-columns: 1fr;
    }

    @media (max-width: 760px) {
      #xfp-panel {
        right: 8px;
        top: 50%;
        width: min(390px, calc(100vw - 16px));
        max-height: calc(100vh - 32px);
      }

      .xfp-header {
        min-height: 58px;
        padding: 10px 12px;
      }

      .xfp-title-button strong {
        font-size: 15px;
      }

      .xfp-actions {
        gap: 6px;
      }

      .xfp-secondary {
        padding: 7px 12px;
      }

      .xfp-body {
        padding: 10px;
      }

      .xfp-settings {
        grid-template-columns: 1fr;
        margin: 0 10px 10px;
      }

      .xfp-metrics {
        grid-template-columns: 1fr;
      }
    }

    @media (max-height: 620px) {
      #xfp-panel {
        top: 8px;
        transform: none;
        max-height: calc(100vh - 16px);
      }
    }
  `);

  createPanel();
  refreshAll(true);
  scheduleAutoRefresh();
})();
