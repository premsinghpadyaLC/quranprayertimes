const BASE = 'https://api.aladhan.com/v1';
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';

// Country defaults are deliberately internal: visitors only choose a country and place.
const countryMethod = { CA:2, US:2, IN:1, PK:1, BD:1, SA:4, EG:5, SG:11, MY:17, ID:20, TR:13, FR:12, MA:21, TN:18, DZ:19, JO:23, GB:3 };
export function suggestMethod(countryCode='') { return countryMethod[countryCode.toUpperCase()] ?? 3; }

export async function searchPlaces(query, countryCode, signal) {
  const term = query.trim();
  if (term.length < 2 || !countryCode) return [];
  const url = new URL(GEO);
  url.search = new URLSearchParams({ name: term, count: '15', language: 'en', countryCode, format: 'json' }).toString();
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Place search is temporarily unavailable (HTTP ${response.status}).`);
  const json = await response.json();
  return (json.results || []).filter(p => p.country_code?.toUpperCase() === countryCode.toUpperCase()).map(p => ({
    id: p.id, name: p.name, country: p.country, countryCode: p.country_code,
    latitude: p.latitude, longitude: p.longitude, timezone: p.timezone || null,
    region: p.admin1 || p.admin2 || ''
  }));
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function requestCalendar(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (![408, 429, 500, 502, 503, 504].includes(response.status)) throw new Error(`Prayer service returned HTTP ${response.status}.`);
        lastError = new Error(`Prayer-time service is temporarily unavailable (HTTP ${response.status}). Please try again shortly.`);
      } else {
        const json = await response.json();
        if (json.code === 200 && Array.isArray(json.data)) return json;
        throw new Error(json.status || 'The prayer-time service returned an unexpected response.');
      }
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      lastError = error.name === 'TypeError'
        ? new Error('Could not reach the prayer-time service. Check your internet connection and try again.')
        : error;
    }
    if (attempt < 2) await wait(800 * (attempt + 1));
  }
  throw lastError || new Error('Prayer-time service is temporarily unavailable. Please try again shortly.');
}

export async function fetchMonthly(location, year, month) {
  if (!Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) throw new Error('Please select a place from the suggestions.');
  const url = new URL(`${BASE}/calendar/${year}/${month}`);
  const params = { latitude: String(location.latitude), longitude: String(location.longitude), method: String(suggestMethod(location.countryCode)), school: '0', iso8601: 'true' };
  if (location.timezone) params.timezonestring = location.timezone;
  url.search = new URLSearchParams(params).toString();
  const json = await requestCalendar(url);
  return { days: json.data, timezone: json.meta?.timezone || location.timezone || null };
}

export function getZonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}

// AlAdhan ISO timings include an explicit offset; parsing them creates an absolute instant.
// The fallback converts the location's wall-clock time to an instant using its IANA timezone.
export function prayerDateTime(row, key, timeZone) {
  const raw = row?.timings?.[key];
  if (!raw) return null;
  const hasExplicitOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  if (hasExplicitOffset) {
    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) return direct;
  }
  const clock = String(raw).includes('T') ? String(raw).split('T')[1] : String(raw);
  const [hour, minute] = clock.slice(0,5).split(':').map(Number);
  const [day, month, year] = String(row.date.gregorian.date).split('-').map(Number);
  if (!timeZone) return new Date(year, month - 1, day, hour, minute);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = getZonedParts(new Date(guess), timeZone);
    const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += target - represented;
  }
  return new Date(guess);
}
export const PRAYER_KEYS = ['Fajr','Dhuhr','Asr','Maghrib','Isha'];
