# Quran for Everyone — Prayer Times & Reminders | Premsingh Padya | Prem

This is an independent application named **Quran for Everyone**. It is not connected to, and does not modify, the earlier Quran reading application. It has its own Vite/React project and its own browser storage.

## Features
- Country selection and city/place autocomplete.
- Prayer times for Fajr, Dhuhr, Asr, Maghrib and Isha.
- Automatic time-zone and prayer calculation setup in the background.
- Analogue and digital clocks for the selected place.
- Upcoming prayer countdown and monthly timetable.
- Individual **Remind me** control for every prayer. Each enabled reminder plays a short alarm 15 minutes before that prayer. Browser notifications are also shown when permission is granted.
- Reminder selections are saved in this browser.

## Run on Windows
1. Extract the ZIP file.
2. Open the extracted project folder.
3. Double-click `START-WINDOWS.bat`, or open a terminal in this folder and run:

```bash
npm install
npm run dev
```

## Important reminder behavior
The alarm is scheduled by the running app in the browser. **Keep the application open in a browser tab** for the sound to play. Browser notifications require permission and a secure context (HTTPS or localhost). If the browser is fully closed, the device is asleep, or the operating system suspends the browser, this standalone front-end cannot guarantee an alarm. Reliable alarms while the browser is closed or the device is asleep would require a native mobile app or a backend push-notification service.

## Prayer-time data
Prayer times are retrieved from the AlAdhan prayer-times API using the selected place's coordinates. City coordinates and IANA time zone are retrieved from Open-Meteo Geocoding. Calculation method is selected automatically from the country. Prayer times are estimates and can differ from a local mosque's timetable; verify locally when needed.

## Technical
- React 18 + Vite 6
- No backend or account required
- Location and reminder preferences are stored locally in the visitor's browser
- Existing Quran reader source and progress are not imported or modified

## Publish to this GitHub repository

The repository is configured for GitHub Pages at:

`https://premsinghpadyaLC.github.io/quranprayertimes/`

The workflow is in `.github/workflows/deploy.yml`. The Vite base path is set to `/quranprayertimes/`, which is required for this project-site URL.
