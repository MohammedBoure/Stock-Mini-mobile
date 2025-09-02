const translations = {};
let currentDictionary = {};

export async function loadTranslations() {
  try {
    const [en, fr, ar] = await Promise.all([
      fetch('../languages/en.json').then(res => res.json()),
      fetch('../languages/fr.json').then(res => res.json()),
      fetch('../languages/ar.json').then(res => res.json())
    ]);
    translations.en = en;
    translations.fr = fr;
    translations.ar = ar;
  } catch (error) {
    console.error("Could not load translation files.", error);
  }
}

export function translate(key) {
  return currentDictionary[key] || key;
}

export function translateUI(lang = 'en') {
  currentDictionary = translations[lang] || translations.en;
  // The following line has been removed to prevent the screen from reversing.
  // document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n-key]').forEach(element => {
    const key = element.getAttribute('data-i18n-key');
    const translation = currentDictionary[key];
    if (translation) {
      if (element.tagName === 'TITLE') {
        element.textContent = translation;
      } else if (element.placeholder !== undefined) {
        element.placeholder = translation;
      } else {
        element.textContent = translation;
      }
    }
  });
}

// This function is for pages WITHOUT a language switcher button.
export function applySavedLanguage() {
  const savedLang = localStorage.getItem('language') || 'en';
  translateUI(savedLang);
}

// --- THIS IS THE FIXED FUNCTION ---
// It is now cleaner, more robust, and handles all its own logic.
export function setupLanguageSwitcher() {
  const selector = document.getElementById('lang-select');
  const display = document.getElementById('lang-display');

  // If there's no switcher on the page, stop immediately.
  if (!selector || !display) return;

  const langDisplayMap = {
    en: '🌐 EN',
    fr: '🌐 FR',
    ar: '🌐 AR'
  };

  const updateDisplay = (lang) => {
    display.textContent = langDisplayMap[lang] || '🌐 EN';
  };

  // 1. Get the currently saved language.
  const savedLang = localStorage.getItem('language') || 'en';

  // 2. Immediately apply this language to the page.
  translateUI(savedLang);

  // 3. Set the visual state of the dropdown to match.
  selector.value = savedLang;
  updateDisplay(savedLang);

  // 4. ATTACH THE EVENT LISTENER to handle user changes.
  selector.addEventListener('change', () => {
    const selectedLang = selector.value;

    // THIS IS THE CRITICAL LINE THAT SAVES THE CHOICE
    localStorage.setItem('language', selectedLang);

    // Update the UI to reflect the new choice
    updateDisplay(selectedLang);
    translateUI(selectedLang);
  });
}