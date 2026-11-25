const KEY='qfe-prem:preferences:v1';
export function loadPreferences(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
export function savePreferences(value){localStorage.setItem(KEY,JSON.stringify(value))}
