
import React, { useState, useEffect } from 'react';

function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (!item || item === 'undefined' || item === 'null') return initialValue;
      
      const parsed = JSON.parse(item);
      
      // حماية صارمة: إذا كنا نتوقع مصفوفة وحصلنا على شيء آخر، نرجع المصفوفة الابتدائية فوراً
      if (Array.isArray(initialValue) && !Array.isArray(parsed)) {
        console.warn(`LocalStorage Key "${key}" expected Array but got something else. Resetting to initialValue.`);
        return initialValue;
      }
      
      return parsed;
    } catch (error) {
      console.error(`Error loading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      }
    } catch (error) {
      console.error(`Error saving localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
