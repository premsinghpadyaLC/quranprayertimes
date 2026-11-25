import React from 'react';
import { PRAYER_KEYS,getZonedParts } from '../services/prayerService.js';
const timeLabel = value => { if (!value) return '—'; const raw = String(value).trim(); const clock = raw.includes('T') ? raw.split('T').pop() : raw; return clock.match(/^(\d{1,2}:\d{2})/)?.[1] || '—'; };
export default function MonthlyTimetable({rows,onClose,city,country,timeZone}){
 const p=timeZone?getZonedParts(new Date(),timeZone):{year:new Date().getFullYear(),month:new Date().getMonth()+1,day:new Date().getDate()};
 const todayKey=`${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
 const remaining=rows.filter(r=>{const [d,m,y]=String(r.date.gregorian.date).split('-');return `${y}-${m}-${d}`>=todayKey;});
 return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="timetable modal" role="dialog" aria-modal="true" aria-label="Monthly prayer timetable" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">QURAN FOR EVERYONE</p><h2>Monthly prayer timetable</h2><p className="muted">{city}, {country}</p></div><button className="icon-btn" onClick={onClose} aria-label="Close">×</button></div><div className="table-scroll"><table><thead><tr><th>Date</th>{PRAYER_KEYS.map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{remaining.map(r=><tr key={r.date.gregorian.date}><td>{r.date.gregorian.day} {r.date.gregorian.month.en}</td>{PRAYER_KEYS.map(k=><td key={k}>{timeLabel(r.timings?.[k])}</td>)}</tr>)}</tbody></table></div><p className="fineprint">Showing the remaining dates in this month. Times are calculated estimates; confirm important timings with your local mosque.</p></section></div>
}
