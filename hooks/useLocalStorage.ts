
import React, { useState, useEffect } from 'react';

function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      
      // إذا كانت القيمة فارغة أو غير معرفة نصياً، نرجع القيمة الابتدائية
      if (!item || item === 'undefined' || item === 'null') {
        return initialValue;
      }
      
      const parsed = JSON.parse(item);
      
      // حماية إضافية للمصفوفات: إذا كان المتوقع مصفوفة والناتج ليس كذلك، نرفض القيمة
      if (Array.isArray(initialValue) && !Array.isArray(parsed)) {
        console.warn(`[Storage Shield] Key "${key}" reset to default (Type mismatch).`);
        return initialValue;
      }
      
      return parsed;
    } catch (error) {
      console.error(`[Storage Error] Key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        // منع تخزين القيم التالفة التي تسبب انهيار التطبيق
        if (storedValue === undefined || storedValue === null) {
          if (!Array.isArray(initialValue)) {
             window.localStorage.removeItem(key);
          }
          return;
        }
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      }
    } catch (error) {
      console.error(`[Storage Save Error] Key "${key}":`, error);
    }
  }, [key, storedValue, initialValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
