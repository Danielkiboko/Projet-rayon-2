import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Animated,
  ActivityIndicator, Alert, BackHandler,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 } from '@expo/vector-icons';
import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './src/lib/firebase';
import { DriverProfile } from './src/lib/orders';
import DashboardScreen from './src/screens/DashboardScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ActiveDeliveryScreen from './src/screens/ActiveDeliveryScreen';

const DRIVER_ROLES = ['driver', 'livreur', 'chauffeur'];
const ADMIN_ROLES = ['super_admin', 'superadmin', 'admin', 'sub_admin', 'subadmin'];

/** Charge le profil livreur ou admin (collection drivers puis users), même logique que l'espace livreur web. */
async function loadDriverProfile(user: User): Promise<{ profile: DriverProfile; isDriver: boolean; isAdmin: boolean }> {
  let driverData: any = null;
  let userData: any = null;
  try {
    const d = await getDoc(doc(db, 'drivers', user.uid));
    if (d.exists()) driverData = d.data();
  } catch {}
  try {
    const u = await getDoc(doc(db, 'users', user.uid));
    if (u.exists()) userData = u.data();
  } catch {}

  const userEmail = (user.email || '').toLowerCase().trim();
  const role = String(userData?.role || driverData?.role || '').toLowerCase();
  
  const isAdmin = userEmail === 'danielkiboko218@gmail.com' || ADMIN_ROLES.includes(role);
  const isDriver = DRIVER_ROLES.includes(role) || !!driverData || isAdmin;

  let supplierId = driverData?.supplierId || 'admin';
  if (supplierId === 'admin' && userData && !isAdmin) {
    if (userData.supplierId && userData.supplierId !== 'admin') supplierId = userData.supplierId;
    else if (userData.parentSupplierId) supplierId = userData.parentSupplierId;
    else if (userData.createdBy && !['admin', 'superAdmin'].includes(userData.createdBy)) supplierId = userData.createdBy;
  }

  const defaultAdminName = userData?.displayName || userData?.name || user.displayName || 'Administrateur Rayon';
  return {
    isDriver,
    isAdmin,
    profile: {
      uid: user.uid,
      name: driverData?.displayName || driverData?.name || (isAdmin ? defaultAdminName : (userData?.name || userData?.displayName || user.displayName || 'Livreur')),
      phone: driverData?.phone || userData?.phone || '',
      vehicle: driverData?.vehicle || userData?.vehicle || (isAdmin ? 'Admin Superviseur' : ''),
      supplierId: isAdmin ? 'admin' : supplierId,
    },
  };
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const [booting, setBooting] = useState(true);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Restaure la session au démarrage (persistance AsyncStorage)
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setBooting(false);
      return;
    }
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setDriver(null);
        setActiveOrderId(null);
        setBooting(false);
        return;
      }
      const { profile, isDriver } = await loadDriverProfile(user);
      if (!isDriver) {
        Alert.alert('Accès refusé', "Ce compte n'est pas un compte livreur. Contactez votre fournisseur ou l'administrateur Rayon.");
        await signOut(auth);
        return;
      }
      setDriver(profile);
      setBooting(false);
    });
  }, []);

  // Bouton retour Android : revenir au tableau de bord depuis une course
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeOrderId) {
        setActiveOrderId(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [activeOrderId]);

  const [currentTab, setCurrentTab] = useState<'missions' | 'history' | 'profile'>('missions');

  if (booting) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#38bdf8" size="large" />
      </View>
    );
  }

  if (!isFirebaseConfigured) {
    return (
      <View style={[styles.container, { justifyContent: 'center', padding: 32 }]}>
        <Text style={[styles.title, { textAlign: 'center' }]}>Configuration manquante</Text>
        <Text style={styles.subtitle}>Les variables EXPO_PUBLIC_FIREBASE_* ne sont pas définies pour ce build.</Text>
      </View>
    );
  }

  if (driver) {
    if (activeOrderId) {
      return <ActiveDeliveryScreen orderId={activeOrderId} driver={driver} onBack={() => setActiveOrderId(null)} />;
    }
    return (
      <View style={{ flex: 1, backgroundColor: '#0F1D27' }}>
        <View style={{ flex: 1 }}>
          {currentTab === 'missions' && (
            <DashboardScreen
              driver={driver}
              onLogout={() => signOut(auth)}
              onOpenOrder={setActiveOrderId}
              onOpenProfile={() => setCurrentTab('profile')}
            />
          )}
          {currentTab === 'history' && (
            <HistoryScreen driver={driver} />
          )}
          {currentTab === 'profile' && (
            <ProfileScreen driver={driver} onLogout={() => signOut(auth)} />
          )}
        </View>

        {/* Bottom Navigation Bar */}
        <SafeAreaView edges={['bottom']} style={styles.bottomNavContainer}>
          <View style={styles.bottomNav}>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setCurrentTab('missions')}
              activeOpacity={0.7}
            >
              <FontAwesome5
                name="tasks"
                size={18}
                color={currentTab === 'missions' ? '#38bdf8' : '#64748b'}
              />
              <Text style={[styles.navLabel, currentTab === 'missions' && styles.navLabelActive]}>
                Missions
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setCurrentTab('history')}
              activeOpacity={0.7}
            >
              <FontAwesome5
                name="history"
                size={18}
                color={currentTab === 'history' ? '#38bdf8' : '#64748b'}
              />
              <Text style={[styles.navLabel, currentTab === 'history' && styles.navLabelActive]}>
                Historique
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setCurrentTab('profile')}
              activeOpacity={0.7}
            >
              <FontAwesome5
                name="user"
                size={18}
                color={currentTab === 'profile' ? '#38bdf8' : '#64748b'}
              />
              <Text style={[styles.navLabel, currentTab === 'profile' && styles.navLabelActive]}>
                Profil
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return <LoginScreen />;
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  // Animations
  const fadeAnimHeader = useRef(new Animated.Value(0)).current;
  const fadeAnimForm = useRef(new Animated.Value(0)).current;
  const translateYHeader = useRef(new Animated.Value(20)).current;
  const translateYForm = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnimHeader, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(translateYHeader, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnimForm, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(translateYForm, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Champs requis', 'Entrez votre email et votre mot de passe.');
      return;
    }
    setLoading(true);
    try {
      console.log('[Auth] Tentative connexion:', email.trim());
      await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log('[Auth] Connexion Firebase réussie');
    } catch (error: any) {
      console.error('[Auth] Erreur:', error);
      const code = error?.code || '';
      let msg = error?.message || 'Erreur inconnue';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        msg = 'Email ou mot de passe incorrect.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Adresse email invalide.';
      } else if (code === 'auth/too-many-requests') {
        msg = 'Trop de tentatives infructueuses. Veuillez patienter quelques instants.';
      } else if (code === 'auth/network-request-failed') {
        msg = 'Impossible de joindre Firebase. Vérifiez votre connexion internet.';
      }
      Alert.alert('Erreur de connexion', `${msg}\n\nCode: ${code || 'inconnu'}`);
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Email requis', 'Entrez votre adresse email dans le champ Email pour réinitialiser le mot de passe.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Email envoyé', 'Vérifiez votre boîte de réception pour réinitialiser votre mot de passe.');
    } catch (error: any) {
      Alert.alert('Erreur', "Impossible d'envoyer l'email de réinitialisation.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <Animated.View style={[styles.header, { opacity: fadeAnimHeader, transform: [{ translateY: translateYHeader }] }]}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>R<Text style={styles.logoHighlight}>.</Text></Text>
          </View>
          <Text style={styles.title}>Livreur</Text>
          <Text style={styles.subtitle}>Connectez-vous pour commencer votre tournée.</Text>
        </Animated.View>

        <Animated.View style={[styles.form, { opacity: fadeAnimForm, transform: [{ translateY: translateYForm }] }]}>
          <View style={styles.inputContainer}>
            <FontAwesome5 name="envelope" size={16} color="#9ca3af" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="votre@email.com"
              placeholderTextColor="#6b7280"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputContainer}>
            <FontAwesome5 name="lock" size={16} color="#9ca3af" style={styles.icon} />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#6b7280"
              secureTextEntry={!showPassword}
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword((s) => !s)} hitSlop={10} accessibilityLabel="Afficher le mot de passe">
              <FontAwesome5 name={showPassword ? 'eye-slash' : 'eye'} size={16} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotPassword} onPress={handleResetPassword}>
            <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleLogin} activeOpacity={0.8} disabled={loading}>
            {loading ? <ActivityIndicator color="#0b061c" /> : <Text style={styles.buttonText}>Se Connecter</Text>}
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b061c',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 40,
    fontWeight: '900',
    color: '#ffffff',
  },
  logoHighlight: {
    color: '#38bdf8',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#140b2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    height: '100%',
    // @ts-ignore
    outlineStyle: 'none' as any,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#ffffff',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#0b061c',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomNavContainer: {
    backgroundColor: '#0F1D27',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  bottomNav: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#0F1D27',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  navLabelActive: {
    color: '#38bdf8',
  },
});
