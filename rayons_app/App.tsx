import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  BackHandler,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import * as SplashScreen from 'expo-splash-screen';

// Empêcher la fermeture automatique du splash avant chargement
SplashScreen.preventAutoHideAsync().catch(() => {});

const TARGET_URL = 'https://rayons.net';

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

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        
        {isError ? (
          <View style={styles.errorContainer}>
            <View style={styles.errorCard}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoText}>R<Text style={styles.logoDot}>.</Text></Text>
              </View>
              <Text style={styles.errorTitle}>Connexion interrompue</Text>
              <Text style={styles.errorSubtitle}>
                Impossible de joindre la plateforme Rayons. Vérifiez votre connexion internet puis réessayez.
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                activeOpacity={0.8}
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
              applicationNameForUserAgent="RayonsApp/1.0"
              mixedContentMode="compatibility"
            />
            {isLoading && (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color="#0284c7" />
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
    backgroundColor: '#ffffff',
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  errorCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.2)',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0f172a',
  },
  logoDot: {
    color: '#0284c7',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
