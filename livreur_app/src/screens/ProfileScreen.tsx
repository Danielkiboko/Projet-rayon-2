import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { DriverProfile, formatMoney } from '../lib/orders';

type Props = {
  driver: DriverProfile;
  onLogout: () => void;
};

export default function ProfileScreen({ driver, onLogout }: Props) {
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    earnings: 0,
    todayEarnings: 0,
  });
  const [extraInfo, setExtraInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let alive = true;
    const fetchStatsAndInfo = async () => {
      try {
        // 1. Lire doc livreur pour compléments
        try {
          const dSnap = await getDoc(doc(db, 'drivers', driver.uid));
          if (dSnap.exists() && alive) setExtraInfo(dSnap.data());
        } catch {}

        // 2. Calculer les statistiques
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const q = query(
          collection(db, 'orders'),
          where('driverId', '==', driver.uid),
          where('status', 'in', ['COMPLETED', 'completed', 'delivered', 'DELIVERED', 'LIVRE'])
        );
        const snap = await getDocs(q);

        let total = 0;
        let todayCount = 0;
        let earnings = 0;
        let todayEarn = 0;

        snap.forEach((d) => {
          const data = d.data();
          total++;
          const amt = Number(data.deliveryFee || data.driverFee || (data.totalAmount || 0) * 0.1 || 0);
          earnings += amt;

          const delivAt = data.deliveredAt?.toDate?.() || data.completedAt?.toDate?.() || null;
          if (delivAt && delivAt >= today) {
            todayCount++;
            todayEarn += amt;
          }
        });

        if (alive) {
          setStats({
            total,
            today: todayCount,
            earnings,
            todayEarnings: todayEarn,
          });
        }
      } catch (err) {
        console.error('Erreur stats profil:', err);
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchStatsAndInfo();
    return () => {
      alive = false;
    };
  }, [driver.uid]);

  const initials = (driver.name || 'L')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isExclusive = driver.supplierId && !['admin', 'superAdmin'].includes(driver.supplierId);

  const confirmLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter de votre compte livreur ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: onLogout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mon Profil</Text>
        <TouchableOpacity
          style={styles.headerLogoutBtn}
          onPress={confirmLogout}
          accessibilityLabel="Déconnexion"
        >
          <FontAwesome5 name="sign-out-alt" size={16} color="#ef4444" />
          <Text style={styles.headerLogoutText}>Quitter</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Identity Card */}
        <View style={styles.identityCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{initials}</Text>
            <View
              style={[
                styles.onlineIndicator,
                { backgroundColor: isOnline ? '#22c55e' : '#6b7280' },
              ]}
            />
          </View>

          <View style={styles.identityInfo}>
            <Text style={styles.driverName}>{driver.name}</Text>
            <Text style={styles.driverRole}>
              {isExclusive ? '🔒 Livreur Exclusif Fournisseur' : '🌐 Livreur Plateforme Rayon'}
            </Text>

            {/* Availability Toggle Button */}
            <TouchableOpacity
              style={[
                styles.availabilityBadge,
                isOnline ? styles.badgeOnline : styles.badgeOffline,
              ]}
              onPress={() => setIsOnline((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isOnline ? '#22c55e' : '#9ca3af' },
                ]}
              />
              <Text
                style={[
                  styles.availabilityText,
                  { color: isOnline ? '#4ade80' : '#9ca3af' },
                ]}
              >
                {isOnline ? 'En ligne (Disponible)' : 'Hors ligne (En pause)'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <Text style={styles.sectionTitle}>Performances & Gains</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, styles.statBoxBlue]}>
            <FontAwesome5 name="box" size={18} color="#38bdf8" />
            <Text style={[styles.statValue, { color: '#38bdf8' }]}>{stats.total}</Text>
            <Text style={styles.statLabel}>Livraisons totales</Text>
          </View>

          <View style={[styles.statBox, styles.statBoxGreen]}>
            <FontAwesome5 name="check-circle" size={18} color="#4ade80" />
            <Text style={[styles.statValue, { color: '#4ade80' }]}>{stats.today}</Text>
            <Text style={styles.statLabel}>Aujourd'hui</Text>
          </View>

          <View style={[styles.statBox, styles.statBoxPurple]}>
            <FontAwesome5 name="money-bill-wave" size={18} color="#a855f7" />
            <Text style={[styles.statValue, { color: '#c084fc' }]}>${stats.earnings.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Gains totaux</Text>
          </View>

          <View style={[styles.statBox, styles.statBoxOrange]}>
            <FontAwesome5 name="coins" size={18} color="#fb923c" />
            <Text style={[styles.statValue, { color: '#fb923c' }]}>
              ${stats.todayEarnings.toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>Gains du jour</Text>
          </View>
        </View>

        {/* Info List */}
        <Text style={styles.sectionTitle}>Coordonnées & Véhicule</Text>
        <View style={styles.infoCard}>
          <InfoRow
            icon="envelope"
            label="Email du compte"
            value={auth.currentUser?.email || '—'}
          />
          <InfoRow
            icon="phone"
            label="Numéro de téléphone"
            value={driver.phone || extraInfo?.phone || 'Non renseigné'}
          />
          <InfoRow
            icon="motorcycle"
            label="Véhicule de tournée"
            value={driver.vehicle || extraInfo?.vehicle || 'Moto'}
          />
          <InfoRow
            icon="id-card"
            label="Plaque d'immatriculation"
            value={extraInfo?.vehiclePlate || 'Non renseignée'}
          />
          <InfoRow
            icon="map-pin"
            label="Zone d'activité"
            value={extraInfo?.zone || 'Kinshasa'}
            isLast
          />
        </View>

        {/* Logout Full Button */}
        <TouchableOpacity
          style={styles.logoutButtonFull}
          onPress={confirmLogout}
          activeOpacity={0.85}
        >
          <FontAwesome5 name="sign-out-alt" size={18} color="#ef4444" />
          <Text style={styles.logoutButtonText}>Se déconnecter de la session</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  isLast = false,
}: {
  icon: string;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <View style={styles.infoIconWrap}>
        <FontAwesome5 name={icon} size={15} color="#9ca3af" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b061c' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#ffffff' },
  headerLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  headerLogoutText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 100 },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 2,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 16,
  },
  avatarText: { fontSize: 22, fontWeight: '900', color: '#38bdf8' },
  onlineIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#0b061c',
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  identityInfo: { flex: 1 },
  driverName: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  driverRole: { fontSize: 12, color: '#9ca3af', marginTop: 2, marginBottom: 8 },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    gap: 6,
    borderWidth: 1,
  },
  badgeOnline: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.3)',
  },
  badgeOffline: {
    backgroundColor: 'rgba(107,114,128,0.12)',
    borderColor: 'rgba(107,114,128,0.3)',
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  availabilityText: { fontSize: 11, fontWeight: '700' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
  },
  statBoxBlue: {
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderColor: 'rgba(56,189,248,0.2)',
  },
  statBoxGreen: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.2)',
  },
  statBoxPurple: {
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderColor: 'rgba(168,85,247,0.2)',
  },
  statBoxOrange: {
    backgroundColor: 'rgba(249,115,22,0.08)',
    borderColor: 'rgba(249,115,22,0.2)',
  },
  statValue: { fontSize: 22, fontWeight: '900', marginTop: 4 },
  statLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  infoValue: { fontSize: 14, color: '#ffffff', fontWeight: '700', marginTop: 2 },
  logoutButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 10,
  },
  logoutButtonText: { color: '#ef4444', fontSize: 15, fontWeight: '800' },
});
