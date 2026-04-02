import { useState, useEffect, useCallback, useRef } from "react";
import staticImageCache from "./image-cache.json";

const STATIC_CACHE = staticImageCache as Record<string, string>;
const LOCAL_STORAGE_KEY = "snack-image-cache";

/**
 * Hook for fast product image loading with multi-tier caching:
 * 1. Static cache (built-in, instant)
 * 2. LocalStorage cache (persists across sessions)
 * 3. API fallback (for new items only)
 */
export function useProductImages() {
  const [images, setImages] = useState<Record<string, string | null>>({});
  const fetchedRef = useRef<Set<string>>(new Set());
  const localCacheRef = useRef<Record<string, string>>({});

  // Load localStorage cache on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        localCacheRef.current = JSON.parse(cached);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save to localStorage
  const saveToLocalStorage = useCallback((newImages: Record<string, string>) => {
    try {
      localCacheRef.current = { ...localCacheRef.current, ...newImages };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localCacheRef.current));
    } catch {
      // Ignore localStorage errors (quota exceeded, etc.)
    }
  }, []);

  // Get image URL - checks all caches first
  const getImage = useCallback((name: string): string | null => {
    const key = name.toLowerCase().trim();

    // Check static cache first (instant)
    if (STATIC_CACHE[key]) {
      return STATIC_CACHE[key];
    }

    // Check localStorage cache
    if (localCacheRef.current[key]) {
      return localCacheRef.current[key];
    }

    // Check already-fetched images
    if (images[key] !== undefined) {
      return images[key];
    }

    return null;
  }, [images]);

  // Prefetch images for a list of names
  const prefetchImages = useCallback(async (names: string[]) => {
    const toFetch: string[] = [];
    const immediate: Record<string, string> = {};

    for (const name of names) {
      const key = name.toLowerCase().trim();

      // Skip if already fetched
      if (fetchedRef.current.has(key)) continue;
      fetchedRef.current.add(key);

      // Check static cache
      if (STATIC_CACHE[key]) {
        immediate[key] = STATIC_CACHE[key];
        continue;
      }

      // Check localStorage
      if (localCacheRef.current[key]) {
        immediate[key] = localCacheRef.current[key];
        continue;
      }

      // Need to fetch from API
      toFetch.push(name);
    }

    // Update state with cached images immediately
    if (Object.keys(immediate).length > 0) {
      setImages((prev) => ({ ...prev, ...immediate }));
    }

    // Fetch missing images from API
    if (toFetch.length > 0) {
      try {
        const res = await fetch("/api/snacks/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ names: toFetch.slice(0, 20) }),
        });

        if (res.ok) {
          const data = await res.json();
          const newImages: Record<string, string> = {};

          for (const [name, url] of Object.entries(data.images)) {
            if (url) {
              const key = name.toLowerCase().trim();
              newImages[key] = url as string;
            }
          }

          if (Object.keys(newImages).length > 0) {
            setImages((prev) => ({ ...prev, ...newImages }));
            saveToLocalStorage(newImages);
          }
        }
      } catch (err) {
        console.error("Failed to fetch images:", err);
      }
    }
  }, [saveToLocalStorage]);

  return { images, getImage, prefetchImages };
}
