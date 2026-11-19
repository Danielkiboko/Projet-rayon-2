"use client";

import { useEffect, useRef } from "react";
import { useLanguage, LanguageCode } from "@/context/LanguageContext";

/**
 * Traducteur global d'interface (Frontend + Backend Admin / Fournisseur / Partenaire / Client).
 * - Quand `lang === "fr"`, restaure immédiatement tous les textes originaux sans aucune requête.
 * - Quand `lang === "en"` ou `"zh"`, traduit automatiquement tous les nœuds texte visibles
 *   de la page active via `/api/translate` avec cache persistant en mémoire + sessionStorage,
 *   en ignorant les champs de saisie, emails, montants, URLs et éléments marqués `data-no-translate`.
 */

const ORIGINAL_TEXT_MAP = new WeakMap<Text, string>();
const CLIENT_CACHE = new Map<string, string>();
const STORAGE_PREFIX = "rayons_tr_v1_";

function loadCached(lang: LanguageCode, text: string): string | null {
  const memKey = `${lang}::${text}`;
  const mem = CLIENT_CACHE.get(memKey);
  if (mem) return mem;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${lang}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed[text] === "string") {
        CLIENT_CACHE.set(memKey, parsed[text]);
        return parsed[text];
      }
    }
  } catch {
    // Ignore storage quota errors
  }
  return null;
}

function saveCachedBatch(lang: LanguageCode, pairs: Array<[string, string]>) {
  try {
    const storageKey = `${STORAGE_PREFIX}${lang}`;
    const existingRaw = sessionStorage.getItem(storageKey);
    const dict: Record<string, string> = existingRaw ? JSON.parse(existingRaw) : {};
    for (const [src, dst] of pairs) {
      CLIENT_CACHE.set(`${lang}::${src}`, dst);
      dict[src] = dst;
    }
    const keys = Object.keys(dict);
    if (keys.length > 1500) {
      for (const k of keys.slice(0, keys.length - 1200)) {
        delete dict[k];
      }
    }
    sessionStorage.setItem(storageKey, JSON.stringify(dict));
  } catch {
    for (const [src, dst] of pairs) {
      CLIENT_CACHE.set(`${lang}::${src}`, dst);
    }
  }
}

function shouldSkipText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;
  if (trimmed.length > 600) return true;
  // Ignorer nombres, prix, dates, emails, URLs, symboles purs, codes promo courts
  if (/^[\d\s$€£¥.,:+/%#()\-–—★☆✓✗•·|]+$/.test(trimmed)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^(FR|EN|ZH|USD|FC|EUR|CDF|RAY-[A-Z0-9-]+|Rayons\.net|KYC|MRR|ARR|APK|PDF|CSV|SMS|ID:.*)$/i.test(trimmed)) {
    return true;
  }
  return false;
}

function isSkippableElement(el: HTMLElement | null): boolean {
  if (!el) return true;
  const tag = el.tagName;
  if (
    tag === "SCRIPT" ||
    tag === "STYLE" ||
    tag === "NOSCRIPT" ||
    tag === "CODE" ||
    tag === "PRE" ||
    tag === "SVG" ||
    tag === "INPUT" ||
    tag === "TEXTAREA"
  ) {
    return true;
  }
  if (el.closest("[data-no-translate='true']")) return true;
  if (el.isContentEditable) return true;
  return false;
}

export default function GlobalUiTranslator() {
  const { lang } = useLanguage();
  const pendingTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || !document.body) return;

    // 1. Si retour au français, restaurer immédiatement tous les nœuds originaux
    if (lang === "fr") {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode() as Text | null;
      while (node) {
        const original = ORIGINAL_TEXT_MAP.get(node);
        if (original !== undefined && node.nodeValue !== original) {
          node.nodeValue = original;
        }
        node = walker.nextNode() as Text | null;
      }
      return;
    }

    let cancelled = false;

    const scanAndTranslate = async () => {
      if (cancelled) return;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodesBySource = new Map<string, Text[]>();

      let node = walker.nextNode() as Text | null;
      while (node) {
        const parent = node.parentElement;
        if (!isSkippableElement(parent)) {
          const currentVal = node.nodeValue || "";
          const original = ORIGINAL_TEXT_MAP.get(node) ?? currentVal;

          // Si c'est un nouveau nœud (pas encore enregistré), mémoriser son texte original
          if (!ORIGINAL_TEXT_MAP.has(node)) {
            if (!shouldSkipText(original)) {
              ORIGINAL_TEXT_MAP.set(node, original);
            }
          }

          const src = ORIGINAL_TEXT_MAP.get(node);
          if (src && !shouldSkipText(src)) {
            const trimmedSrc = src.trim();
            // Si déjà en chinois et cible zh, ne pas re-traduire
            if (lang === "zh" && /[\u4e00-\u9fff]/.test(trimmedSrc) && !/[a-zA-ZÀ-ÿ]{3,}/.test(trimmedSrc)) {
              node = walker.nextNode() as Text | null;
              continue;
            }

            const cached = loadCached(lang, trimmedSrc);
            if (cached) {
              const leading = src.match(/^\s*/)?.[0] || "";
              const trailing = src.match(/\s*$/)?.[0] || "";
              const replaced = `${leading}${cached}${trailing}`;
              if (node.nodeValue !== replaced) {
                node.nodeValue = replaced;
              }
            } else if (!inFlightRef.current.has(`${lang}::${trimmedSrc}`)) {
              const list = nodesBySource.get(trimmedSrc) || [];
              list.push(node);
              nodesBySource.set(trimmedSrc, list);
            }
          }
        }
        node = walker.nextNode() as Text | null;
      }

      const uniqueSources = Array.from(nodesBySource.keys());
      if (uniqueSources.length === 0) return;

      // Traiter par paquets de 40 phrases max
      for (let i = 0; i < uniqueSources.length; i += 40) {
        if (cancelled) return;
        const batch = uniqueSources.slice(i, i + 40);
        batch.forEach((s) => inFlightRef.current.add(`${lang}::${s}`));

        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts: batch, targetLang: lang }),
          });
          const data = await res.json();
          if (cancelled || !data?.success || !Array.isArray(data.translations)) continue;

          const cachePairs: Array<[string, string]> = [];
          batch.forEach((srcText, idx) => {
            const translated = String(data.translations[idx] || srcText).trim();
            cachePairs.push([srcText, translated]);
            const targetNodes = nodesBySource.get(srcText) || [];
            for (const textNode of targetNodes) {
              const fullOriginal = ORIGINAL_TEXT_MAP.get(textNode) || srcText;
              const leading = fullOriginal.match(/^\s*/)?.[0] || "";
              const trailing = fullOriginal.match(/\s*$/)?.[0] || "";
              if (textNode.isConnected) {
                textNode.nodeValue = `${leading}${translated}${trailing}`;
              }
            }
          });
          saveCachedBatch(lang, cachePairs);
        } catch {
          // Ignore network errors silently
        } finally {
          batch.forEach((s) => inFlightRef.current.delete(`${lang}::${s}`));
        }
      }
    };

    const scheduleScan = () => {
      if (pendingTimerRef.current) {
        window.clearTimeout(pendingTimerRef.current);
      }
      pendingTimerRef.current = window.setTimeout(() => {
        scanAndTranslate();
      }, 180);
    };

    // Premier passage immédiat
    scheduleScan();

    // Observer les changements DOM (navigation Next.js, modales, données Firestore chargées)
    const observer = new MutationObserver(() => {
      scheduleScan();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      if (pendingTimerRef.current) {
        window.clearTimeout(pendingTimerRef.current);
      }
    };
  }, [lang]);

  return null;
}
