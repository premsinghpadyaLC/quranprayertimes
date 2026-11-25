import React from 'react';
import { getZonedParts } from '../services/prayerService.js';
export default function AnalogClock({now,timeZone}){
 const p=timeZone?getZonedParts(now,timeZone):{hour:now.getHours(),minute:now.getMinutes(),second:now.getSeconds()};
 const s=p.second, m=p.minute, h=p.hour%12;
 return <div className="analog" role="img" aria-label={`Analogue clock showing ${p.hour}:${String(m).padStart(2,'0')}`}><div className="hand hour" style={{transform:`translateX(-50%) rotate(${h*30+m*.5}deg)`}}/><div className="hand minute" style={{transform:`translateX(-50%) rotate(${m*6+s*.1}deg)`}}/><div className="hand second" style={{transform:`translateX(-50%) rotate(${s*6}deg)`}}/><i/></div>
}
