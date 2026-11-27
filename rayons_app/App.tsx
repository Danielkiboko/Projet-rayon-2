import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  BackHandler,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as SplashScreen from 'expo-splash-screen';

// Empêcher la fermeture automatique du splash avant chargement
SplashScreen.preventAutoHideAsync().catch(() => {});

const BASE_ORIGIN = 'https://rayons.net';

const EXTERNAL_SCHEMES = ['tel:', 'mailto:', 'sms:', 'whatsapp:', 'intent:', 'geo:', 'maps:'];

const EXTERNAL_DOMAINS = [
  'wa.me',
  'api.whatsapp.com',
  'maps.google.com',
  'www.google.com/maps',
  'maps.apple.com',
  'buy.stripe.com',
  'checkout.stripe.com',
  'checkout.flutterwave.com',
  'www.paypal.com',
];

/**
 * Pont natif injecté dans la WebView :
 * - Branche `navigator.share` sur la feuille de partage native iOS/Android (AirDrop, WhatsApp, Messages).
 * - Expose `window.__RAYONS_NATIVE_OS__` pour les ajustements d'interface natifs.
 */
const NATIVE_BRIDGE_JS = `
(function() {
  if (window.__RAYONS_BRIDGE_READY__) return;
  window.__RAYONS_BRIDGE_READY__ = true;
  window.__RAYONS_NATIVE_OS__ = "${Platform.OS}";
  try {
    navigator.share = function(data) {
      return new Promise(function(resolve) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SHARE',
            title: (data && data.title) || document.title || 'Rayons.net',
            text: (data && data.text) || '',
            url: (data && data.url) || window.location.href
          }));
        }
        resolve();
      });
    };
  } catch (e) {}
})();
true;
`;

/**
 * Convertit un Deep Link entrant (`https://rayons.net/...`, `https://www.rayons.net/...` ou `rayons://...`)
 * en URL HTTPS sécurisée autorisée dans la WebView Rayons.
 */
function resolveIncomingDeepLink(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith('rayons://')) {
      const pathPart = trimmed.replace(/^rayons:\/\//, '').replace(/^\/+/, '');
      return `${BASE_ORIGIN}/${pathPart}`;
    }

    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (
      parsed.protocol === 'https:' &&
      (host === 'rayons.net' || host === 'www.rayons.net')
    ) {
      return `${BASE_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return null;
  }

  return null;
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [currentUrl, setCurrentUrl] = useState<string>(BASE_ORIGIN);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Gérer les Deep Links / Universal Links iOS au lancement et lorsque l'app est déjà ouverte
  useEffect(() => {
    Linking.getInitialURL()
      .then((initialUrl) => {
        const resolved = resolveIncomingDeepLink(initialUrl);
        if (resolved) {
          setCurrentUrl(resolved);
        }
      })
      .catch(() => {});

    const linkSub = Linking.addEventListener('url', ({ url }) => {
      const resolved = resolveIncomingDeepLink(url);
      if (resolved) {
        setIsError(false);
        setCurrentUrl(resolved);
      }
    });

    return () => {
      linkSub.remove();
    };
  }, []);

  // 2. Gérer le bouton retour matériel (Android)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });

    return () => {
      subscription.remove();
    };
  }, [canGoBack]);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const handleReload = () => {
    setIsError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  };

  // 3. Messages envoyés par le site vers le code natif (Partage iOS/Android, ouverture externe)
  const handleWebMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data || '{}');
      if (msg.type === 'SHARE') {
        const shareUrl = typeof msg.url === 'string' && msg.url.startsWith('http') ? msg.url : BASE_ORIGIN;
        const shareText = [msg.text, shareUrl].filter(Boolean).join('\n');
        await Share.share(
          Platform.OS === 'ios'
            ? { title: msg.title || 'Rayons.net', message: msg.text || msg.title || 'Découvrez sur Rayons.net', url: shareUrl }
            : { title: msg.title || 'Rayons.net', message: shareText }
        );
      } else if (msg.type === 'OPEN_EXTERNAL' && typeof msg.url === 'string' && msg.url.startsWith('https://')) {
        Linking.openURL(msg.url).catch(() => {});
      }
    } catch {
      // Ignorer les messages non JSON
    }
  }, []);

  // 4. Ouvrir WhatsApp, Appels, Plans/Maps et passerelles Visa externes nativement hors WebView (Safari / Chrome)
  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    const url = request.url || '';
    const lower = url.toLowerCase();
    const isExternalScheme = EXTERNAL_SCHEMES.some((scheme) => lower.startsWith(scheme));
    const isExternalDomain = EXTERNAL_DOMAINS.some(
      (domain) => lower.startsWith(`https://${domain}`) || lower.startsWith(`http://${domain}`)
    );

    if (isExternalScheme || isExternalDomain) {
      Linking.openURL(url).catch(() => {});
      return false;
    }
    return true;
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar style="light" />

        {isError ? (
          <View style={styles.errorContainer}>
            <View style={styles.errorCard}>
              <View style={styles.logoBadge}>
                <Image
                  source={require('./assets/ios-icon.png')}
                  style={{ width: 56, height: 56, borderRadius: 14 }}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.errorTitle}>Connexion interrompue</Text>
              <Text style={styles.errorSubtitle}>
                Impossible de joindre la plateforme Rayons.net. Vérifiez votre connexion internet puis réessayez.
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                activeOpacity={0.85}
                onPress={handleReload}
              >
                <Text style={styles.retryButtonText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.webviewContainer}>
            <WebView
              ref={webViewRef}
              source={{ uri: currentUrl }}
              style={styles.webview}
              injectedJavaScript={NATIVE_BRIDGE_JS}
              onMessage={handleWebMessage}
              onNavigationStateChange={(navState) => {
                setCanGoBack(navState.canGoBack);
              }}
              onShouldStartLoadWithRequest={handleShouldStartLoad}
              onLoadEnd={handleLoadEnd}
              onContentProcessDidTerminate={() => {
                // Récupération automatique si iOS WKWebView libère la mémoire en arrière-plan
                webViewRef.current?.reload();
              }}
              onError={() => {
                setIsError(true);
                setIsLoading(false);
                SplashScreen.hideAsync().catch(() => {});
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              pullToRefreshEnabled={true}
              bounces={Platform.OS === 'ios'}
              decelerationRate={Platform.OS === 'ios' ? 'normal' : undefined}
              contentInsetAdjustmentBehavior="never"
              allowsBackForwardNavigationGestures={true}
              allowsInlineMediaPlayback={true}
              allowsLinkPreview={Platform.OS === 'ios'}
              mediaPlaybackRequiresUserAction={false}
              setSupportMultipleWindows={false}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              cacheEnabled={true}
              applicationNameForUserAgent={`RayonsApp/1.2 (${Platform.OS})`}
              mixedContentMode="compatibility"
            />
            {isLoading && (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <Image
                  source={require('./assets/ios-icon.png')}
                  style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 16 }}
                  resizeMode="contain"
                />
                <ActivityIndicator size="large" color="#C7D300" />
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1D27',
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0F1D27',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F1D27',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0F1D27',
  },
  errorCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#152735',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(199, 211, 0, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(199, 211, 0, 0.35)',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#C7D300',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#0F1D27',
    fontSize: 15,
    fontWeight: '800',
  },
});
