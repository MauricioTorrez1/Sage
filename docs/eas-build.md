# Guía: compilar Sage con EAS Build

Cómo pasar de Expo Go a una app instalable de verdad (build de desarrollo,
build interna para probar, o build para las tiendas). Todo se compila en la
nube de Expo — no necesitas Mac ni Android Studio.

## 0. Requisitos

- Cuenta gratis en [expo.dev](https://expo.dev).
- Para **iOS en tu iPhone**: membresía del
  [Apple Developer Program](https://developer.apple.com/programs/) (99 USD/año).
  Sin ella no se puede instalar en un iPhone físico; para demos gratis usa la
  build de Android (APK).
- Para **Android**: nada extra. El APK de `preview` se instala directo.

## 1. Inicia sesión y vincula el proyecto

```bash
npx eas-cli login
npx eas-cli init
```

`eas init` crea el proyecto en tu cuenta y escribe `extra.eas.projectId` en
`app.json`. Los perfiles de build ya están definidos en `eas.json`:

| Perfil | Para qué |
|---|---|
| `development` | Como Expo Go pero con tu código nativo; requiere Metro corriendo |
| `preview` | Build instalable para probar/demo (Android genera APK) |
| `production` | Build para App Store / Play Store, auto-incrementa versión |

## 2. Variables de entorno

El `.env` local está en `.gitignore` y **no** viaja a la nube de EAS, así que
las variables públicas hay que registrarlas una vez por ambiente:

```bash
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://<tu-ref>.supabase.co" --environment development --environment preview --environment production --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<tu-anon-key>" --environment development --environment preview --environment production --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_DONATION_URL --value "https://link.mercadopago.com.mx/sagemx" --environment development --environment preview --environment production --visibility plaintext
```

⚠️ Solo las `EXPO_PUBLIC_*`. La `SUPABASE_SERVICE_ROLE_KEY` y la
`VOYAGE_API_KEY` jamás se suben a un build: son solo para scripts locales.

## 3. Lanza la build

Antes de compilar, un chequeo de salud nunca sobra:

```bash
npx expo-doctor
```

**Android (gratis, ideal para demo):**

```bash
npx eas-cli build --platform android --profile preview
```

Al terminar, EAS da una URL con QR: se abre en el teléfono y el APK se
instala directo (autoriza "instalar apps de origen desconocido").

**iOS (requiere Apple Developer):**

```bash
npx eas-cli build --platform ios --profile preview
```

EAS pregunta por tus credenciales de Apple y genera/administra los
certificados solo. Con distribución `internal` necesitas registrar tu iPhone
(EAS te guía con `eas device:create`) — o usa TestFlight con el perfil
`production` + `eas submit`.

## 4. Ajustes de la app al salir de Expo Go

Cosas que cambian respecto a Expo Go y ya están contempladas en el código:

- **Deep links**: el esquema pasa de `exp://…` a `sage://`. Agrega
  `sage://auth-callback` a las Redirect URLs de Supabase
  (Authentication → URL Configuration) para que Google OAuth funcione en la
  build igual que en Expo Go.
- **Notificaciones**: `expo-notifications` locales funcionan igual o mejor
  (en build de desarrollo ya no aparece la advertencia de Expo Go).
- **Identificadores**: `mx.sage.app` quedó fijado como `bundleIdentifier`
  (iOS) y `package` (Android) en `app.json`. Cámbialo **antes** de la primera
  build si prefieres otro; después de publicar ya no se puede.

## 5. Tiendas (cuando toque)

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios

npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android
```

`eas submit` sube a App Store Connect / Play Console; ahí sigues el flujo
normal de revisión de cada tienda (capturas, descripción, privacidad).

## Problemas comunes

- **"No bundle identifier"** → ya está en `app.json`; si EAS lo vuelve a
  pedir, corre `eas build:configure`.
- **La app abre pero no conecta a Supabase** → faltaron las variables del
  paso 2 en ese ambiente (`npx eas-cli env:list --environment preview`).
- **Google OAuth regresa al navegador y no a la app** → falta
  `sage://auth-callback` en las Redirect URLs de Supabase.
- **Build de iOS falla por credenciales** → `npx eas-cli credentials` y deja
  que EAS las regenere.
