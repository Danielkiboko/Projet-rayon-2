"use client";

import { useEffect, useRef } from "react";
import { useLanguage, LanguageCode } from "@/context/LanguageContext";
import { lookupStaticTranslation } from "@/lib/uiTranslations";

/**
 * Traducteur global d'interface haute performance (Frontend + Backend Admin / Fournisseur / Partenaire / Client).
 * - Dictionnaire statique O(1) + cache persistant localStorage chargé UNE seule fois en RAM (0ms).
 * - Détecte les mises à jour dynamiques React via LAST_APPLIED_MAP pour ne jamais écraser un nouveau texte.
 * - Annule automatiquement les requêtes obsolètes (AbortController) lors d'un changement rapide de langue.
 * - Ignore ses propres mutations DOM et ne scanne que les sous-arbres modifiés pour une fluidité 60fps.
 */

const ORIGINAL_TEXT_MAP = new WeakMap<Text, string>();
const LAST_APPLIED_MAP = new WeakMap<Text, string>();

const CLIENT_CACHE = new Map<LanguageCode, Map<string, string>>([
  ["en", new Map()],
  ["zh", new Map()],
]);
const LOADED_STORAGE = new Set<LanguageCode>();
const STORAGE_PREFIX = "rayons_tr_v2_";
const FLUSH_TIMERS = new Map<LanguageCode, number>();

function ensureCacheLoaded(lang: LanguageCode): Map<string, string> {
  let map = CLIENT_CACHE.get(lang);
  if (!map) {
    map = new Map();
    CLIENT_CACHE.set(lang, map);
  }
  if (LOADED_STORAGE.has(lang) || typeof window === "undefined") {
    return map;
  }
  LOADED_STORAGE.add(lang);
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${lang}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "string") {
            map.set(k, v);
          }
        }
      }
    }
  } catch {
    // Ignore storage quota or private mode errors
  }
  return map;
}

function getFastTranslation(lang: LanguageCode, text: string): string | null {
  if (lang === "fr") return text;
  const staticHit = lookupStaticTranslation(lang, text);
  if (staticHit) return staticHit;
  const map = ensureCacheLoaded(lang);
  return map.get(text) ?? null;
}

function schedulePersistCache(lang: LanguageCode) {
  if (typeof window === "undefined") return;
  const existing = FLUSH_TIMERS.get(lang);
  if (existing) window.clearTimeout(existing);
  const timer = window.setTimeout(() => {
    FLUSH_TIMERS.delete(lang);
    try {
      const map = CLIENT_CACHE.get(lang);
      if (!map) return;
      const entries = Array.from(map.entries());
      const trimmed = entries.length > 2500 ? entries.slice(entries.length - 2000) : entries;
      const obj: Record<string, string> = {};
      for (const [k, v] of trimmed) {
        obj[k] = v;
      }
      localStorage.setItem(`${STORAGE_PREFIX}${lang}`, JSON.stringify(obj));
    } catch {
      // Ignore quota errors
    }
  }, 500);
  FLUSH_TIMERS.set(lang, timer);
}

function saveCachedBatch(lang: LanguageCode, pairs: Array<[string, string]>) {
  if (pairs.length === 0) return;
  const map = ensureCacheLoaded(lang);
  for (const [src, dst] of pairs) {
    map.set(src, dst);
  }
  schedulePersistCache(lang);
}

function shouldSkipText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;
  if (trimmed.length > 600) return true;
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
    tag === "PATH" ||
    tag === "INPUT" ||
    tag === "TEXTAREA"
  ) {
    return true;
  }
  if (el.closest("[data-no-translate='true']")) return true;
  if (el.isContentEditable) return true;
  return false;
}

function applyTranslatedValue(textNode: Text, fullOriginal: string, translated: string) {
  const leading = fullOriginal.match(/^\s*/)?.[0] || "";
  const trailing = fullOriginal.match(/\s*$/)?.[0] || "";
  const replaced = `${leading}${translated}${trailing}`;
  LAST_APPLIED_MAP.set(textNode, replaced);
  if (textNode.nodeValue !== replaced) {
    textNode.nodeValue = replaced;
  }
}

export default function GlobalUiTranslator() {
  const { lang } = useLanguage();
  const pendingTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());
  const isApplyingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || !document.body) return;

    // 1. Retour au français : restauration instantanée 0ms sans requête réseau
    if (lang === "fr") {
      isApplyingRef.current = true;
      try {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode() as Text | null;
        while (node) {
          const original = ORIGINAL_TEXT_MAP.get(node);
          const lastApplied = LAST_APPLIED_MAP.get(node);
          // Ne restaurer que si React n'a pas déjà remplacé le texte par une valeur plus récente
          if (original !== undefined && lastApplied !== undefined && node.nodeValue === lastApplied) {
            node.nodeValue = original;
            LAST_APPLIED_MAP.delete(node);
          }
          node = walker.nextNode() as Text | null;
        }
      } finally {
        isApplyingRef.current = false;
      }
      return;
    }

    // Pré-charger le cache localStorage en mémoire une seule fois
    ensureCacheLoaded(lang);

    let cancelled = false;
    const abortController = new AbortController();
    const pendingRoots = new Set<Node>();

    const scanAndTranslate = async (roots?: Node[]) => {
      if (cancelled || !document.body) return;

      const targets: Node[] = roots && roots.length > 0 ? roots : [document.body];
      const nodesBySource = new Map<string, Text[]>();

      isApplyingRef.current = true;
      try {
        for (const root of targets) {
          if (!root.isConnected) continue;

          const processTextNode = (node: Text) => {
            const parent = node.parentElement;
            if (isSkippableElement(parent)) return;

            const currentVal = node.nodeValue || "";
            const lastApplied = LAST_APPLIED_MAP.get(node);

            // Si React a mis à jour ce nœud texte depuis notre dernière traduction, mettre à jour la source originale !
            if (!ORIGINAL_TEXT_MAP.has(node) || (lastApplied !== undefined && currentVal !== lastApplied)) {
              if (!shouldSkipText(currentVal)) {
                ORIGINAL_TEXT_MAP.set(node, currentVal);
                LAST_APPLIED_MAP.delete(node);
              } else {
                ORIGINAL_TEXT_MAP.delete(node);
                LAST_APPLIED_MAP.delete(node);
                return;
              }
            }

            const src = ORIGINAL_TEXT_MAP.get(node);
            if (!src || shouldSkipText(src)) return;

            const trimmedSrc = src.trim();
            if (lang === "zh" && /[\u4e00-\u9fff]/.test(trimmedSrc) && !/[a-zA-ZÀ-ÿ]{3,}/.test(trimmedSrc)) {
              return;
            }

            const fastHit = getFastTranslation(lang, trimmedSrc);
            if (fastHit) {
              applyTranslatedValue(node, src, fastHit);
            } else if (!inFlightRef.current.has(`${lang}::${trimmedSrc}`)) {
              const list = nodesBySource.get(trimmedSrc);
              if (list) {
                list.push(node);
              } else {
                nodesBySource.set(trimmedSrc, [node]);
              }
            }
          };

          if (root.nodeType === Node.TEXT_NODE) {
            processTextNode(root as Text);
          } else {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode() as Text | null;
            while (node) {
              processTextNode(node);
              node = walker.nextNode() as Text | null;
            }
          }
        }
      } finally {
        isApplyingRef.current = false;
      }

      const uniqueSources = Array.from(nodesBySource.keys());
      if (uniqueSources.length === 0) return;

      // Diviser en paquets de 100 max (traités en parallèle jusqu'à 2 requêtes simultanées)
      const batches: string[][] = [];
      for (let i = 0; i < uniqueSources.length; i += 100) {
        batches.push(uniqueSources.slice(i, i + 100));
      }

      await Promise.all(
        batches.map(async (batch) => {
          if (cancelled) return;
          batch.forEach((s) => inFlightRef.current.add(`${lang}::${s}`));
          try {
            const res = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ texts: batch, targetLang: lang }),
              signal: abortController.signal,
            });
            if (!res.ok) return;
            const data = await res.json();
            if (cancelled || !data?.success || !Array.isArray(data.translations)) return;

            const cachePairs: Array<[string, string]> = [];
            isApplyingRef.current = true;
            try {
              batch.forEach((srcText, idx) => {
                const translated = String(data.translations[idx] || srcText).trim();
                if (translated) {
                  cachePairs.push([srcText, translated]);
                  const targetNodes = nodesBySource.get(srcText) || [];
                  for (const textNode of targetNodes) {
                    if (!textNode.isConnected) continue;
                    // Vérifier que React n'a pas modifié ce nœud pendant l'appel réseau
                    const fullOriginal = ORIGINAL_TEXT_MAP.get(textNode);
                    if (fullOriginal && fullOriginal.trim() === srcText) {
                      applyTranslatedValue(textNode, fullOriginal, translated);
                    }
                  }
                }
              });
            } finally {
              isApplyingRef.current = false;
            }
            saveCachedBatch(lang, cachePairs);
          } catch {
            // AbortError ou erreur réseau ignorée silencieusement
          } finally {
            batch.forEach((s) => inFlightRef.current.delete(`${lang}::${s}`));
          }
        })
      );
    };

    const scheduleIncrementalScan = () => {
      if (pendingTimerRef.current) {
        window.clearTimeout(pendingTimerRef.current);
      }
      pendingTimerRef.current = window.setTimeout(() => {
        pendingTimerRef.current = null;
        if (pendingRoots.size === 0) return;
        const roots = Array.from(pendingRoots);
        pendingRoots.clear();
        // Si trop de sous-arbres modifiés (ex: changement de route Next.js), un seul scan global est plus rapide
        if (roots.length > 25) {
          scanAndTranslate();
        } else {
          scanAndTranslate(roots);
        }
      }, 90);
    };

    // Premier passage IMMÉDIAT (0ms) pour un changement de langue instantané !
    scanAndTranslate();

    // Observer uniquement les nouveaux éléments ajoutés au DOM (navigation, modales, données Firestore)
    const observer = new MutationObserver((mutations) => {
      if (isApplyingRef.current || cancelled) return;
      let hasNewNodes = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          for (let i = 0; i < m.addedNodes.length; i++) {
            const added = m.addedNodes[i];
            if (added.nodeType === Node.ELEMENT_NODE || added.nodeType === Node.TEXT_NODE) {
              pendingRoots.add(added);
              hasNewNodes = true;
            }
          }
        }
      }
      if (hasNewNodes) {
        scheduleIncrementalScan();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      cancelled = true;
      abortController.abort();
      observer.disconnect();
      if (pendingTimerRef.current) {
        window.clearTimeout(pendingTimerRef.current);
      }
    };
  }, [lang]);

  return null;
}
