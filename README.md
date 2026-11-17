# SAFAR LINK — Android + web location sharing

This is a starter project, not a finished or security-audited production release.

## Current prototype features
- English interface with SAFAR LINK / falcon identity
- Create time-limited location-sharing sessions
- Separate recipient share link and private dashboard link
- Recipient must explicitly consent, then grant browser GPS permission
- Live foreground location updates while the recipient page remains active
- Dashboard refreshes every five seconds
- Open the current coordinates in Google Maps
- Android share sheet can offer installed apps such as WhatsApp and IMO; availability depends on the phone
- Session can be stopped from the dashboard or expires automatically

## Run locally
1. Install Node.js 18 or newer.
2. Run `npm install` in this folder.
3. Set a strong administrator key:
   - Linux/macOS: `ADMIN_KEY='use-a-long-random-secret' npm start`
   - Windows PowerShell: `$env:ADMIN_KEY='use-a-long-random-secret'; npm start`
4. Open `http://localhost:3000`.

## Before public deployment — mandatory
- Deploy behind HTTPS. Browser geolocation generally requires a secure context.
- Set a unique, high-entropy `ADMIN_KEY`; never use the sample/default key.
- Replace JSON-file storage with a managed database and persistent backups.
- Add rate limiting, audit-safe logging, monitoring, abuse controls, and security review.
- Configure correct proxy handling if deployed behind a reverse proxy.
- Protect dashboard links as secrets; anyone possessing one can view that session.
- Test consent, permission denial, expiry, session stop, Android WebView behavior, and link sharing on real devices.
- The recipient page uses foreground browser GPS. Background tracking is not guaranteed if the page is closed or the operating system suspends it.

## Android APK status
The Android Studio source wrapper is included. `MainActivity.kt` still requires the real HTTPS deployment URL in `appUrl`. Android SDK / Gradle build tools and a deployed HTTPS server are required to compile and test an APK. No APK is included in this source archive.
