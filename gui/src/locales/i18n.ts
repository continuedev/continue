import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Import translation files
import translationEN from "./en.json";
import translationZH from "./zh.json";

// Configure i18next
i18n
  .use(initReactI18next) // Bind react-i18next to i18next
  .init({
    resources: {
      en: {
        translation: translationEN,
      },
      zh: {
        translation: translationZH,
      },
    },
    lng: "en", // Default language
    fallbackLng: "en", // Fallback language when the current language is not found
    interpolation: {
      escapeValue: false, // Disable escaping of values in HTML content, set to false when using HTML tags or components
    },
  });

export default i18n;
