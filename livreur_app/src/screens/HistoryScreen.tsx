import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DriverProfile, formatMoney, shortId, getClientAddress } from '../lib/orders';

type Period = 'today' | 'week' | 'month' | 'all';

type Props = {
  driver: DriverProfile;
};

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: '7 jours' },
  { key: 'month', label: 'Ce mois' },
  { key: 'all', label: 'Tout' },
];

export default function HistoryScreen({ driver }: Props) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('all');

  const loadHistory = async () => {
    try {
      const q = query(
        collection(db, 'orders'),
        where('driverId', '==', driver.uid),
        limit(100)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      list.sort((a: any, b: any) => {
        const ta = a.completedAt?.toMillis?.() || a.deliveredAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const tb = b.completedAt?.toMillis?.() || b.deliveredAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });

      setOrders(list);
    } catch (e) {
      console.error('Erreur chargement historique:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [driver.uid]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (period === 'all') return true;
      const d = o.completedAt?.toDate?.() || o.deliveredAt?.toDate?.() || o.createdAt?.toDate?.() || null;
      if (!d) return false;

      const now = new Date();
      if (period === 'today') {
        return d.toDateString() === now.toDateString();
      }
      if (period === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      }
      if (period === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [orders, period]);

  const { totalEarnings, completedCount } = useMemo(() => {
    let sum = 0;
    let count = 0;
    filtered.forEach((o) => {
      const s = (o.status || '').toUpperCase();
      if (['COMPLETED', 'DELIVERED', 'LIVRE'].includes(s)) {
        count++;
        sum += Number(o.deliveryFee || o.driverFee || (o.totalAmount || 0) * 0.1 || 0);
      }
    });
    return { totalEarnings: sum, completedCount: count };
  }, [filtered]);

  const renderItem = ({ item }: { item: any }) => {
    const isCompleted = ['COMPLETED', 'DELIVERED', 'LIVRE'].includes((item.status || '').toUpperCase());
    const isCancelled = ['CANCELLED'].includes((item.status || '').toUpperCase());
    const fee = Number(item.deliveryFee || item.driverFee || (item.totalAmount || 0) * 0.1 || 0);
    const date = item.completedAt?.toDate?.() || item.deliveredAt?.toDate?.() || item.createdAt?.toDate?.() || null;
    const addr = getClientAddress(item) || '—';

    return (
      <View style={styles.orderCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderNumber}>#{shortId(item.id)}</Text>
          <View
            style={[
              styles.statusBadge,
              isCompleted
                ? styles.badgeCompleted
                : isCancelled
                ? styles.badgeCancelled
                : styles.badgeInProgress,
            ]}
          >
            <FontAwesome5
              name={isCompleted ? 'check-circle' : isCancelled ? 'times-circle' : 'clock'}
              size={11}
              color={isCompleted ? '#4ade80' : isCancelled ? '#f87171' : '#38bdf8'}
            />
            <Text
              style={[
                styles.statusText,
                { color: isCompleted ? '#4ade80' : isCancelled ? '#f87171' : '#38bdf8' },
              ]}
            >
              {isCompleted ? 'Livré' : isCancelled ? 'Annulée' : 'En cours'}
            </Text>
          </View>
        </View>

        <View style={styles.addressRow}>
          <FontAwesome5 name="map-marker-alt" size={13} color="#6b7280" style={{ marginTop: 2, marginRight: 8 }} />
          <Text style={styles.addressText} numberOfLines={2}>
            {addr}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            {date
              ? date.toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Date inconnue'}
          </Text>
          {isCompleted && (
            <Text style={styles.earningText}>+{formatMoney(fee, item.currency)}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Historique des courses</Text>
          <Text style={styles.subtitle}>
            {filtered.length} course{filtered.length > 1 ? 's' : ''} au total
          </Text>
        </View>
      </View>

      {/* Period Filter Tabs */}
      <View style={styles.periodsWrap}>
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              onPress={() => setPeriod(p.key)}
              style={[styles.periodTab, active && styles.periodTabActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.periodText, active && styles.periodTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Earnings Summary Banner */}
      <View style={styles.earningsBanner}>
        <View>
          <Text style={styles.earningsLabel}>Gains sur la période</Text>
          <Text style={styles.earningsAmount}>${totalEarnings.toFixed(2)}</Text>
          <Text style={styles.earningsSub}>
            {completedCount} livraison{completedCount > 1 ? 's' : ''} réussie{completedCount > 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.earningsIconWrap}>
          <FontAwesome5 name="wallet" size={24} color="#38bdf8" />
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <FontAwesome5 name="box-open" size={44} color="#374151" />
          <Text style={styles.emptyText}>Aucune course trouvée sur cette période.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b061c' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#ffffff' },
  subtitle: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  periodsWrap: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
  },
  periodTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  periodTabActive: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  periodText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
  },
  periodTextActive: {
    color: '#0b061c',
  },
  earningsBanner: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
  },
  earningsSub: {
    fontSize: 12,
    color: '#38bdf8',
    marginTop: 4,
    fontWeight: '600',
  },
  earningsIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 14,
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
  },
  badgeCompleted: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.25)',
  },
  badgeCancelled: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.25)',
  },
  badgeInProgress: {
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderColor: 'rgba(56,189,248,0.25)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  addressText: {
    fontSize: 13,
    color: '#d1d5db',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280',
  },
  earningText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#4ade80',
  },
});
