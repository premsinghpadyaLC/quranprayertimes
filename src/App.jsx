import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Volume2, VolumeX, MapPin, CalendarDays, Settings2, Bell, BellRing } from 'lucide-react';
import AnalogClock from './components/AnalogClock.jsx';
import MonthlyTimetable from './components/MonthlyTimetable.jsx';
import { PRAYER_KEYS, fetchMonthly, prayerDateTime, searchPlaces, getZonedParts } from './services/prayerService.js';
import { loadPreferences, savePreferences } from './storage/preferences.js';

const countryCodes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
const COUNTRIES = countryCodes.map(code => [code, displayNames.of(code) || code]).sort((a, b) => a[1].localeCompare(b[1]));
const countryName = code => COUNTRIES.find(c => c[0] === code)?.[1] || code;
const REMINDER_KEY = 'quran-for-everyone:prayer-reminders:v1';
const ALARM_LEAD_MS = 15 * 60 * 1000;

function fmtTime(d, tz, twelve = true) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: twelve, ...(tz ? { timeZone: tz } : {}) }).format(d);
}
function prayerTimeLabel(value) {
  if (!value) return '—';
  const raw = String(value).trim();
  // AlAdhan's ISO-8601 response starts with the date, so extract the clock after T.
  const clock = raw.includes('T') ? raw.split('T').pop() : raw;
  const match = clock.match(/^(\d{1,2}:\d{2})/);
  return match ? match[1] : '—';
}
function rowKey(row) {
  const [d, m, y] = String(row.date.gregorian.date).split('-');
  return `${y}-${m}-${d}`;
}
function getStoredReminders() {
  try { return JSON.parse(localStorage.getItem(REMINDER_KEY) || '{}'); } catch { return {}; }
}
function saveReminders(value) {
  try { localStorage.setItem(REMINDER_KEY, JSON.stringify(value)); } catch { /* Storage may be unavailable in private browsing. */ }
}
function playAlarm() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const now = context.currentTime;
    [0, 0.42, 0.84].forEach(offset => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now + offset);
      oscillator.frequency.setValueAtTime(1175, now + offset + 0.16);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, now + offset + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.32);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(now + offset); oscillator.stop(now + offset + 0.34);
    });
    window.setTimeout(() => context.close().catch(() => {}), 1800);
  } catch (error) { console.warn('Prayer reminder sound could not play:', error); }
}
function App() {
  const saved = useMemo(() => loadPreferences(), []);
  const [location, setLocation] = useState(saved?.location || null);
  const [city, setCity] = useState(saved?.location?.name || '');
  const [country, setCountry] = useState(saved?.location?.countryCode || 'CA');
  const [placeResults, setPlaceResults] = useState([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [rows, setRows] = useState([]);
  const [nextRows, setNextRows] = useState([]);
  const [cityTimezone, setCityTimezone] = useState(saved?.location?.timezone || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [now, setNow] = useState(new Date());
  const [sound, setSound] = useState(false);
  const [showSettings, setShowSettings] = useState(!saved?.location);
  const [locationChosen, setLocationChosen] = useState(Boolean(saved?.location));
  const [showMonth, setShowMonth] = useState(false);
  const [reminders, setReminders] = useState(getStoredReminders);
  const firedRef = useRef({});
  const [notice, setNotice] = useState('');
  const [twelveHour] = useState(true);

  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { saveReminders(reminders); }, [reminders]);

  const load = async (selected = location) => {
    if (!selected) { setError('Choose a place from the suggestions first.'); return; }
    setLoading(true); setError('');
    try {
      const localNow = selected.timezone ? getZonedParts(new Date(), selected.timezone) : { year: now.getFullYear(), month: now.getMonth() + 1 };
      const year = localNow.year, month = localNow.month;
      const current = await fetchMonthly(selected, year, month);
      let following = { days: [], timezone: current.timezone };
      try { following = month === 12 ? await fetchMonthly(selected, year + 1, 1) : await fetchMonthly(selected, year, month + 1); }
      catch { /* Current month's schedule remains available if next month's request fails. */ }
      setRows(current.days); setNextRows(following.days);
      setCityTimezone(current.timezone || selected.timezone || null);
      setLocation(selected); setCity(selected.name); setCountry(selected.countryCode);
      savePreferences({ location: selected }); setLocationChosen(true); setShowSettings(false);
    } catch (e) { setError(e.message || 'Could not load prayer times. Please try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (saved?.location) load(saved.location); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (city.trim().length < 2 || !country) { setPlaceResults([]); setSearchError(''); setSearchingPlaces(false); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchingPlaces(true); setSearchError('');
      try {
        const found = await searchPlaces(city, country, controller.signal);
        setPlaceResults(found);
        if (!found.length) setSearchError('No matching places found in this country. Try another spelling.');
      } catch (e) { if (e.name !== 'AbortError') setSearchError(e.message || 'Place search is temporarily unavailable.'); }
      finally { if (!controller.signal.aborted) setSearchingPlaces(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [city, country]);

  const allRows = [...rows, ...nextRows];
  const todayParts = cityTimezone ? getZonedParts(now, cityTimezone) : { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  const todayKey = `${todayParts.year}-${String(todayParts.month).padStart(2, '0')}-${String(todayParts.day).padStart(2, '0')}`;
  const today = allRows.find(r => rowKey(r) === todayKey);
  const upcoming = useMemo(() => {
    if (!today) return null;
    for (const key of PRAYER_KEYS) { const at = prayerDateTime(today, key, cityTimezone); if (at && at > now) return { name: key, at }; }
    const tomorrowDate = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day + 1));
    const tomorrowKey = `${tomorrowDate.getUTCFullYear()}-${String(tomorrowDate.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getUTCDate()).padStart(2, '0')}`;
    const tomorrow = allRows.find(r => rowKey(r) === tomorrowKey);
    return tomorrow ? { name: 'Fajr', at: prayerDateTime(tomorrow, 'Fajr', cityTimezone) } : null;
  }, [today, allRows, now, cityTimezone, todayKey]);

  // Prayer reminders are scheduled locally in this open browser tab. Each prayer has its own switch.
  useEffect(() => {
    if (!allRows.length || !location) return;
    for (const prayer of PRAYER_KEYS) {
      if (!reminders[prayer]) continue;
      // Find the next occurrence of this prayer (today or a later date in the loaded calendar).
      let candidate = null;
      for (const row of allRows) {
        if (rowKey(row) < todayKey) continue;
        const at = prayerDateTime(row, prayer, cityTimezone);
        if (at && at.getTime() > now.getTime()) { candidate = { row, at, dateKey: rowKey(row) }; break; }
      }
      if (!candidate) continue;
      const alarmAt = new Date(candidate.at.getTime() - ALARM_LEAD_MS);
      const alarmKey = `${candidate.dateKey}:${prayer}`;
      if (now >= alarmAt && now < candidate.at && !firedRef.current[alarmKey]) {
        firedRef.current[alarmKey] = true;
        playAlarm();
        setNotice(`${prayer} is in 15 minutes.`);
        if ('Notification' in window && Notification.permission === 'granted') {
          try { new Notification(`${prayer} in 15 minutes`, { body: `Prayer time in ${city}, ${location.country}.`, tag: `qfe-${alarmKey}` }); } catch { /* Sound still plays if notifications are unavailable. */ }
        }
      }
    }
  }, [now, allRows, todayKey, cityTimezone, reminders, location, city]);

  const toggleReminder = async prayer => {
    const enabled = Boolean(reminders[prayer]);
    if (!enabled && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch { /* Browser may deny or not support permission prompts. */ }
    }
    setReminders(previous => ({ ...previous, [prayer]: !previous[prayer] }));
    setNotice(!enabled ? `${prayer} reminder enabled — alarm 15 minutes before prayer.` : `${prayer} reminder turned off.`);
  };

  const countdown = upcoming ? Math.max(0, Math.floor((upcoming.at - now) / 1000)) : null;
  const countdownText = countdown === null ? '—' : [Math.floor(countdown / 3600), Math.floor(countdown % 3600 / 60), countdown % 60].map(v => String(v).padStart(2, '0')).join(':');

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">Q</div><div><p className="eyebrow">QURAN FOR EVERYONE</p><h1>Pause. Remember. Reflect.</h1></div><button className="settings-btn" onClick={() => { setError(''); setShowSettings(true); }}><Settings2 size={17} /> Change location</button></header>
    <section className="hero"><div className="hero-copy"><p className="eyebrow gold">YOUR DAILY PRAYER COMPANION</p><h2>Make time for what matters.</h2><p className="muted">A calm space to stay aware of prayer times and prepare for each prayer.</p></div><div className="clock-panel"><div className="clock-row"><AnalogClock now={now} timeZone={cityTimezone} /><div><div className="digital-time">{fmtTime(now, cityTimezone, twelveHour)}</div><div className="date-line">{new Intl.DateTimeFormat(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', ...(cityTimezone ? { timeZone: cityTimezone } : {}) }).format(now)}</div><button className="sound-toggle" onClick={() => setSound(v => !v)}>{sound ? <Volume2 size={15} /> : <VolumeX size={15} />} {sound ? 'Ticking sound on' : 'Enable ticking sound'}</button></div></div></div></section>
    {!rows.length ? <section className="empty-state"><MapPin /><h2>Choose your prayer location</h2><p>Select a country, search for your city or place, and choose it from the suggestions. No device location is collected.</p><button className="primary" onClick={() => setShowSettings(true)}>Set my location</button></section> : <section className="content-grid">
      <article className="next-card"><p className="eyebrow gold">UPCOMING PRAYER</p>{upcoming ? <><h2>Next prayer: {upcoming.name}</h2><div className="prayer-time">{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: twelveHour, ...(cityTimezone ? { timeZone: cityTimezone } : {}) }).format(upcoming.at)}</div><p className="muted">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', ...(cityTimezone ? { timeZone: cityTimezone } : {}) }).format(upcoming.at)}</p><div className="countdown"><Clock3 size={18} /><span>{countdownText}</span><small>remaining</small></div><p className="reminder">Prepare for {upcoming.name}.</p></> : <p>Upcoming prayer information is temporarily unavailable. Please refresh the timetable.</p>}<button className="outline-light" onClick={() => setShowMonth(true)}><CalendarDays size={16} /> View monthly timetable</button></article>
      <article className="today-card"><div className="card-head"><div><p className="eyebrow">TODAY</p><h2>Prayer schedule</h2></div><span className="location-pill"><MapPin size={13} />{city}, {location?.country || countryName(country)}</span></div>
        <div className="prayer-list">{PRAYER_KEYS.map(prayer => <div className={`prayer-line ${upcoming?.name === prayer ? 'active' : ''}`} key={prayer}><span className="prayer-name">{prayer}</span><strong>{today ? prayerTimeLabel(today.timings?.[prayer]) : '—'}</strong><button type="button" className={`remind-btn ${reminders[prayer] ? 'enabled' : ''}`} onClick={() => toggleReminder(prayer)} aria-pressed={Boolean(reminders[prayer])} title={reminders[prayer] ? `Turn off ${prayer} reminder` : `Remind me 15 minutes before ${prayer}`}><span>{reminders[prayer] ? <BellRing size={14} /> : <Bell size={14} />}</span>{reminders[prayer] ? 'Reminder on' : 'Remind me'}</button></div>)}</div>
        <p className="reminder-help">Choose “Remind me” for any prayer to hear an alarm 15 minutes beforehand.</p>
      </article>
    </section>}
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}
    <footer>Prayer times are calculated estimates and may differ from your local mosque. Reminders sound while this app is open in your browser; keep this tab open and allow notifications for on-screen alerts.</footer>
    {showSettings && <div className="modal-backdrop" role="presentation" onClick={() => !loading && setShowSettings(false)}><section className="modal settings-modal" role="dialog" aria-modal="true" aria-label="Choose your location" onClick={e => e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">YOUR LOCATION</p><h2>Choose your city or place</h2></div><button className="icon-btn" onClick={() => setShowSettings(false)} aria-label="Close">×</button></div><label>Country<select value={country} onChange={e => { setCountry(e.target.value); setCity(''); setLocation(null); setLocationChosen(false); setPlaceResults([]); setError(''); }}>{COUNTRIES.map(c => <option value={c[0]} key={c[0]}>{c[1]}</option>)}</select></label><label>City or place<input value={city} onChange={e => { setCity(e.target.value); setLocation(null); setLocationChosen(false); setError(''); }} placeholder="Type to search places…" autoComplete="off" /></label>{searchingPlaces && <p className="place-hint">Finding places…</p>}{searchError && !searchingPlaces && !locationChosen && <p className="place-hint">{searchError}</p>}{placeResults.length > 0 && !locationChosen && <div className="place-results" role="listbox" aria-label="Matching places">{placeResults.map(place => <button type="button" role="option" aria-selected="false" key={place.id} onClick={() => { setLocation(place); setCity(place.name); setLocationChosen(true); setPlaceResults([]); setSearchError(''); }}><strong>{place.name}</strong><span>{[place.region, place.country].filter(Boolean).join(', ')}</span></button>)}</div>}{locationChosen && location && <p className="selected-place">Selected: <strong>{location.name}</strong>{location.region ? `, ${location.region}` : ''}, {location.country}</p>}{error && <p className="error">{error}</p>}<button className="primary full" disabled={loading || !location} onClick={() => load(location)}>{loading ? 'Loading prayer times…' : 'Continue'}</button><p className="fineprint">Time zone and prayer-time calculation settings are selected automatically.</p></section></div>}
    {showMonth && <MonthlyTimetable rows={rows} city={city} country={location?.country || countryName(country)} timeZone={cityTimezone} onClose={() => setShowMonth(false)} />}
  </main>;
}
export default App;
