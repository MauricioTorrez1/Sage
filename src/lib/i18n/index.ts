import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import esMX from "./locales/es-MX/common.json";

// es-MX is the launch locale; add "en" here when English lands.
export const resources = {
  "es-MX": { common: esMX },
} as const;

export const defaultNS = "common";

// eslint-disable-next-line import/no-named-as-default-member -- chaining off the default export is the idiomatic i18next API
i18n.use(initReactI18next).init({
  resources,
  lng: getLocales()[0]?.languageTag ?? "es-MX",
  fallbackLng: "es-MX",
  ns: [defaultNS],
  defaultNS,
  interpolation: {
    // React already escapes rendered strings.
    escapeValue: false,
  },
});

export default i18n;
