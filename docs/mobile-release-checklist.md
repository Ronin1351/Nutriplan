# Nutriplan mobile packaging

Nutriplan uses Vite for the web build and Capacitor for Android packaging. The original `index.html` remains unchanged; the packaged app loads the React build from `dist`.

## Local web development

```powershell
npm install
npm run dev
```

Open the Vite URL shown in the terminal. URL recipe import uses `/api/recipe-import` in a deployed web environment. For local URL import, run the serverless API through the project’s deployment/dev-server integration or set `VITE_IMPORT_API_BASE_URL` to a reachable API origin.

## Android project generation

```powershell
npm install
npm run build
npx cap add android
npx cap sync android
```

`capacitor.config.ts` uses `dist` as `webDir`, app ID `com.nutriplan.app`, and HTTPS for the Android WebView scheme. Run `npx cap add android` only once; later changes use `npx cap sync android`.

## Android emulator or device testing

```powershell
npm run build
npx cap sync android
npx cap open android
```

Run the app from Android Studio on an emulator or USB-connected device. For live reload during device testing, use a reachable development host and configure Capacitor’s `server.url` locally; do not commit that local override.

Check portrait and narrow-phone widths, keyboard/form scrolling, back navigation, safe-area padding, offline startup, pantry/meal-plan persistence, and URL import. A Capacitor WebView needs `VITE_IMPORT_API_BASE_URL` pointed at the deployed `/api/recipe-import` origin because the server-assisted import endpoint is not bundled into `dist`.

## Production build

```powershell
npm test
npm run typecheck
npm run build
npx cap sync android
```

For a signed Android release, use Android Studio’s normal Generate Signed Bundle/APK workflow after syncing.

## Assets and deferred features

The repository currently has no suitable production icon or splash artwork. Capacitor/Android default placeholders remain until branded assets are supplied; add them through the Capacitor asset workflow before release.

Ratings, admin approval, bookmarklets, and multi-device sync remain deferred.
