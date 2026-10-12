import React from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList, Alert, Vibration, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import SwipeButton from '../components/SwipeButton';
import { db } from '../lib/firebase';
import {
  ORDER_STATUS, ACTIVE_STATUSES, DriverProfile, acceptMission, isOrderForDriver,
  getClientName, getClientAddress, getAmountToCollect, formatMoney, shortId,
} from '../lib/orders';

type Props = {
  driver: DriverProfile;
  onLogout: () => void;
  onOpenOrder: (id: string) => void;
  onOpenProfile?: () => void;
};

const byNewest = (a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);

export default function DashboardScreen({ driver, onLogout, onOpenOrder, onOpenProfile }: Props) {
  const [available, setAvailable] = React.useState<any[]>([]);
  const [mine, setMine] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [todayEarnings, setTodayEarnings] = React.useState(0);
  const prevIds = React.useRef<Set<string> | null>(null);

  const isExclusive = driver.supplierId && !['admin', 'superAdmin'].includes(driver.supplierId);
  const initial = (driver.name || 'L').charAt(0).toUpperCase();

  // ── Gains du jour ──
  React.useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const qToday = query(
      collection(db, 'orders'),
      where('driverId', '==', driver.uid),
      where('status', 'in', ['COMPLETED', 'completed', 'delivered', 'DELIVERED', 'LIVRE'])
    );
    const unsub = onSnapshot(
      qToday,
      (snap) => {
        let sum = 0;
        snap.forEach((d) => {
          const data = d.data();
          const date = data.deliveredAt?.toDate?.() || data.completedAt?.toDate?.() || null;
          if (date && date >= today) {
            sum += Number(data.deliveryFee || data.driverFee || (data.totalAmount || 0) * 0.1 || 0);
          }
        });
        setTodayEarnings(sum);
      },
      () => {}
    );
    return unsub;
  }, [driver.uid, refreshKey]);

  // ── Courses disponibles ──
  React.useEffect(() => {
    setError(null);
    const q = query(collection(db, 'orders'), where('status', '==', ORDER_STATUS.AWAITING_DRIVER));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((o) => isOrderForDriver(o, driver.supplierId))
          .sort(byNewest);

        // Vibration si nouvelle course
        const ids = new Set(list.map((o) => o.id));
        if (prevIds.current && list.some((o) => !prevIds.current!.has(o.id))) {
          Vibration.vibrate([0, 300, 150, 300]);
        }
        prevIds.current = ids;

        setAvailable(list);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(
          err.code === 'permission-denied'
            ? "Accès refusé : compte non autorisé."
            : 'Impossible de charger les courses. Vérifiez votre connexion.'
        );
        setLoading(false);
      }
    );
    return unsub;
  }, [driver.supplierId, refreshKey]);

  // ── Mes courses en cours ──
  React.useEffect(() => {
    const q = query(collection(db, 'orders'), where('driverId', '==', driver.uid));
    return onSnapshot(
      q,
      (snap) => {
        setMine(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((o: any) => ACTIVE_STATUSES.includes(o.status))
            .sort(byNewest)
        );
      },
      () => {}
    );
  }, [driver.uid, refreshKey]);

  const handleAccept = async (orderId: string) => {
    try {
      await acceptMission(orderId, driver);
      onOpenOrder(orderId);
      return true;
    } catch (e: any) {
      if (e.code === 'ALREADY_ACCEPTED') {
        Alert.alert('Trop tard', 'Cette course vient d’être acceptée par un autre livreur.');
        setAvailable((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        Alert.alert('Erreur', e.message || "Impossible d'accepter cette course.");
      }
      return false;
    }
  };

  const confirmLogout = () =>
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: onLogout },
    ]);

  const renderOrder = ({ item }: { item: any }) => {
    const address = getClientAddress(item);
    const itemsCount = Array.isArray(item.items)
      ? item.items.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0)
      : 0;

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderCardHeader}>
          <View style={styles.packageIconWrap}>
            <FontAwesome5 name="box" size={16} color="#fb923c" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.orderIdText}>#ORD-{shortId(item.id)}</Text>
            <Text style={styles.orderItemsCount}>
              {itemsCount > 0 ? `${itemsCount} article(s)` : 'Nouvelle commande'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.orderAmountText}>
              {formatMoney(getAmountToCollect(item), item.currency)}
            </Text>
            <Text style={styles.orderSubAmount}>à encaisser</Text>
          </View>
        </View>

        <View style={styles.addressRow}>
          <FontAwesome5 name="map-marker-alt" size={13} color="#6b7280" style={{ marginTop: 2, marginRight: 8 }} />
          <Text style={styles.addressText} numberOfLines={2}>
            {address || 'Adresse non spécifiée'}
          </Text>
        </View>

        <View style={{ marginTop: 14 }}>
          <SwipeButton title="Glisser pour accepter" onConfirm={() => handleAccept(item.id)} />
        </View>
      </View>
    );
  };

  const header = (
    <View>
      {/* Top Header Aligné sur le Web */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.subTitle}>TABLEAU DE BORD</Text>
          <Text style={styles.title}>Bonjour, {driver.name.split(' ')[0]} 👋</Text>
          <Text style={styles.roleBadge}>
            {isExclusive ? '🔒 Livreur Exclusif' : '🌐 Livreur Indépendant'}
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={confirmLogout}
            accessibilityLabel="Se déconnecter"
          >
            <FontAwesome5 name="sign-out-alt" size={15} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={onOpenProfile}
            activeOpacity={0.8}
            accessibilityLabel="Mon profil"
          >
            <Text style={styles.avatarInitial}>{initial}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI Cards (Gains du jour & Courses en cours) */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCardGreen}>
          <View style={styles.kpiHeader}>
            <FontAwesome5 name="chart-line" size={13} color="#4ade80" />
            <Text style={styles.kpiLabel}>Gains du jour</Text>
          </View>
          <Text style={styles.kpiValueGreen}>${todayEarnings.toFixed(2)}</Text>
        </View>

        <View style={styles.kpiCardDark}>
          <View style={styles.kpiHeader}>
            <FontAwesome5 name="motorcycle" size={13} color="#38bdf8" />
            <Text style={styles.kpiLabel}>Courses en cours</Text>
          </View>
          <Text style={styles.kpiValueWhite}>{mine.length}</Text>
        </View>
      </View>

      {/* Mes courses en cours */}
      {mine.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={styles.sectionTitle}>🔵 MES COURSES EN COURS</Text>
          {mine.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={styles.activeMissionCard}
              activeOpacity={0.85}
              onPress={() => onOpenOrder(o.id)}
            >
              <View style={styles.activeCardHeader}>
                <View style={styles.activeCardIcon}>
                  <FontAwesome5 name="box" size={16} color="#38bdf8" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.activeOrderTitle}>#ORD-{shortId(o.id)}</Text>
                  <Text style={styles.activeOrderSub}>
                    {Array.isArray(o.items) ? `${o.items.length} article(s)` : 'En livraison'}
                  </Text>
                </View>
                <View style={styles.activeStatusPill}>
                  <Text style={styles.activeStatusText}>
                    {o.status === ORDER_STATUS.ARRIVED ? 'ARRIVÉ' : 'EN ROUTE'}
                  </Text>
                </View>
              </View>

              <View style={styles.addressRow}>
                <FontAwesome5 name="map-marker-alt" size={12} color="#6b7280" style={{ marginTop: 2, marginRight: 8 }} />
                <Text style={styles.activeAddressText} numberOfLines={1}>
                  {getClientAddress(o) || 'Adresse client'}
                </Text>
              </View>

              <View style={styles.activeFooter}>
                <Text style={styles.activeTimeText}>
                  {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.activeAmount}>
                    {formatMoney(getAmountToCollect(o), o.currency)}
                  </Text>
                  <FontAwesome5 name="chevron-right" size={12} color="#4ade80" style={{ marginLeft: 6 }} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Section Header Courses Disponibles */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          🟢 COURSES DISPONIBLES
        </Text>
        {available.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{available.length}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const empty = (
    <View style={styles.emptyContainer}>
      <FontAwesome5 name="motorcycle" size={38} color="#374151" style={{ marginBottom: 14 }} />
      <Text style={styles.emptyTitle}>Aucune nouvelle course pour le moment.</Text>
      <Text style={styles.emptySubtitle}>Vous serez alerté dès qu'une course est disponible.</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <FlatList
        data={available}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        ListHeaderComponent={header}
        ListEmptyComponent={loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#38bdf8" />
          </View>
        ) : empty}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 110 }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => setRefreshKey((k) => k + 1)} tintColor="#38bdf8" />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1D27' },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 4,
  },
  subTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 3,
  },
  roleBadge: {
    fontSize: 12,
    color: '#38bdf8',
    marginTop: 4,
    fontWeight: '600',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 17,
    fontWeight: '900',
    color: '#38bdf8',
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  kpiCardGreen: {
    flex: 1,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
    borderRadius: 18,
    padding: 16,
  },
  kpiCardDark: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    padding: 16,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  kpiValueGreen: {
    fontSize: 24,
    fontWeight: '900',
    color: '#4ade80',
  },
  kpiValueWhite: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  countBadge: {
    marginLeft: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '800',
  },
  emptyContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  emptyTitle: {
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  activeMissionCard: {
    backgroundColor: '#0F1D27',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  activeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  activeCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeOrderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  activeOrderSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  activeStatusPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  activeStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
  },
  activeAddressText: {
    fontSize: 13,
    color: '#ffffff',
    flex: 1,
  },
  activeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
    marginTop: 6,
  },
  activeTimeText: {
    fontSize: 11,
    color: '#64748b',
  },
  activeAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#4ade80',
  },
  orderCard: {
    backgroundColor: '#0F1D27',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  orderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  packageIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIdText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  orderItemsCount: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  orderAmountText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4ade80',
  },
  orderSubAmount: {
    fontSize: 10,
    color: '#64748b',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  addressText: {
    fontSize: 13,
    color: '#e2e8f0',
    flex: 1,
  },
});
