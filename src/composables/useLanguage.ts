import { ref, watch } from 'vue';
import type { Language } from '../types/portfolio';

const STORAGE_KEY = 'portfolio_language';

const getInitialLanguage = (): Language => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'id' || saved === 'en') {
      return saved;
    }
  }
  return 'id';
};

const currentLanguage = ref<Language>(getInitialLanguage());

if (typeof window !== 'undefined') {
  watch(currentLanguage, (newLang) => {
    localStorage.setItem(STORAGE_KEY, newLang);
    document.documentElement.lang = newLang;
  }, { immediate: true });
}

export function useLanguage() {
  const setLanguage = (lang: Language) => {
    currentLanguage.value = lang;
  };

  const toggleLanguage = () => {
    currentLanguage.value = currentLanguage.value === 'id' ? 'en' : 'id';
  };

  return {
    currentLanguage,
    setLanguage,
    toggleLanguage
  };
}
