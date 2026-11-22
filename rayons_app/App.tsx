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
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import * as SplashScreen from 'expo-splash-screen';

// Empêcher la fermeture automatique du splash avant chargement
SplashScreen.preventAutoHideAsync().catch(() => {});

const TARGET_URL = 'https://rayons.net';

const EXTERNAL_SCHEMES = ['tel:', 'mailto:', 'sms:', 'whatsapp:', 'intent:', 'geo:'];

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Gérer le bouton retour matériel (Android)
  useEffect(() => {
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

  // Ouvrir WhatsApp, Appels téléphoniques, Emails et Google Maps nativement hors WebView
  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    const url = request.url || '';
    const lower = url.toLowerCase();
    const isExternalScheme = EXTERNAL_SCHEMES.some((scheme) => lower.startsWith(scheme));
    const isExternalAppLink =
      lower.startsWith('https://wa.me/') ||
      lower.startsWith('https://api.whatsapp.com/') ||
      lower.startsWith('https://maps.google.com/') ||
      lower.startsWith('https://www.google.com/maps');

    if (isExternalScheme || isExternalAppLink) {
      Linking.openURL(url).catch(() => {});
      return false;
    }
    return true;
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />

        {isError ? (
          <View style={styles.errorContainer}>
            <View style={styles.errorCard}>
              <View style={styles.logoBadge}>
                <Image
                  source={require('./assets/icon.png')}
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
              source={{ uri: TARGET_URL }}
              style={styles.webview}
              onNavigationStateChange={(navState) => {
                setCanGoBack(navState.canGoBack);
              }}
              onShouldStartLoadWithRequest={handleShouldStartLoad}
              onLoadEnd={handleLoadEnd}
              onError={() => {
                setIsError(true);
                setIsLoading(false);
                SplashScreen.hideAsync().catch(() => {});
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              pullToRefreshEnabled={true}
              allowsBackForwardNavigationGestures={true}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              cacheEnabled={true}
              applicationNameForUserAgent="RayonsApp/1.1"
              mixedContentMode="compatibility"
            />
            {isLoading && (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <Image
                  source={require('./assets/icon.png')}
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
