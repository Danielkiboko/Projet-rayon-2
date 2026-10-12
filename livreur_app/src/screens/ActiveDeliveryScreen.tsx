import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Linking, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLocationTracking } from '../hooks/useLocationTracking';
import DeliveryMap from '../components/DeliveryMap';
import SwipeButton from '../components/SwipeButton';
import {
  ORDER_STATUS, DriverProfile, LatLng, markArrived, confirmDelivery, releaseMission, publishDriverLocation,
  resolveDestination, distanceKm, getClientName, getClientPhone, getClientAddress, getAmountToCollect,
  formatMoney, shortId,
} from '../lib/orders';

type Props = { orderId: string; driver: DriverProfile; onBack: () => void };

const PUBLISH_MIN_INTERVAL_MS = 10_000;

export default function ActiveDeliveryScreen({ orderId, driver, onBack }: Props) {
  const [order, setOrder] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [destination, setDestination] = React.useState<LatLng | null>(null);
  const [approximate, setApproximate] = React.useState(false);
  const lastPublish = React.useRef(0);

  const isMine = order?.driverId === driver.uid;
  const isActive = isMine && (order?.status === ORDER_STATUS.ACCEPTED || order?.status === ORDER_STATUS.ARRIVED);

  // ── Écoute temps réel de la commande ──
  React.useEffect(() => {
    return onSnapshot(
      doc(db, 'orders', orderId),
      (snap) => {
        if (snap.exists()) setOrder({ id: snap.id, ...snap.data() });
        else setNotFound(true);
        setLoading(false);
      },
      () => {
        setNotFound(true);
        setLoading(false);
      }
    );
  }, [orderId]);

  // ── Position de livraison (une seule fois) ──
  const destKey = order ? `${getClientAddress(order)}|${order.clientLocation?.lat}|${order.clientLocation?.lng}` : '';
  React.useEffect(() => {
    if (!order) return;
    let alive = true;
    resolveDestination(order).then(({ location, approximate }) => {
      if (!alive) return;
      setDestination(location);
      setApproximate(approximate);
    });
    return () => {
      alive = false;
    };
  }, [destKey]);

  // ── GPS : publication de la position pour le suivi client (au plus toutes les 10 s) ──
  const { location, errorMsg } = useLocationTracking({
    enabled: isActive,
    onUpdate: (loc) => {
      const now = Date.now();
      if (now - lastPublish.current < PUBLISH_MIN_INTERVAL_MS) return;
      lastPublish.current = now;
      publishDriverLocation(orderId, { lat: loc.coords.latitude, lng: loc.coords.longitude }).catch((e) =>
        console.warn('publish location', e?.code)
      );
    },
  });
  const driverPos: LatLng | null = location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null;
  const distance = driverPos && destination && !approximate ? distanceKm(driverPos, destination) : null;

  // ── Actions ──
  const handleArrived = async () => {
    try {
      await markArrived(order);
      return true;
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de mettre à jour le statut.');
      return false;
    }
  };

  const handleDelivered = () =>
    new Promise<boolean>((resolve) => {
      Alert.alert(
        'Confirmer la livraison',
        `Confirmez-vous avoir remis la commande et encaissé ${formatMoney(getAmountToCollect(order), order.currency)} ?`,
        [
          { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Confirmer',
            onPress: async () => {
              try {
                await confirmDelivery(order, driver);
                resolve(true);
                Alert.alert('Course terminée 🎉', 'Merci ! La livraison est enregistrée.', [{ text: 'OK', onPress: onBack }]);
              } catch (e: any) {
                Alert.alert('Erreur', e.message);
                resolve(false);
              }
            },
          },
        ],
        { cancelable: false }
      );
    });

  const handleRelease = () =>
    Alert.alert(
      'Abandonner la course ?',
      'La course sera remise à disposition des autres livreurs. Le client ne sera pas annulé.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Abandonner',
          style: 'destructive',
          onPress: async () => {
            try {
              await releaseMission(orderId);
              onBack();
            } catch (e: any) {
              Alert.alert('Erreur', "Impossible d'abandonner la course. Contactez le support.");
            }
          },
        },
      ]
    );

  const phone = order ? getClientPhone(order) : '';
  const address = order ? getClientAddress(order) : '';

  const openNavigation = () => {
    const url = destination && !approximate
      ? `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, Kinshasa`)}`;
    Linking.openURL(url).catch(() => Alert.alert('Erreur', "Impossible d'ouvrir la navigation."));
  };
  const call = () => phone && Linking.openURL(`tel:${phone}`);
  const whatsapp = () =>
    phone && Linking.openURL(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`).catch(() => {});

  // ── États de chargement / erreur ──
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color="#38bdf8" size="large" />
        <Text style={styles.muted}>Chargement de la course…</Text>
      </SafeAreaView>
    );
  }

  if (notFound || !order || (!isMine && order.status !== ORDER_STATUS.COMPLETED)) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <FontAwesome5 name="exclamation-circle" size={40} color="#f87171" />
        <Text style={[styles.muted, { marginTop: 16 }]}>
          {notFound ? 'Course introuvable.' : 'Cette course n’est plus assignée à votre compte.'}
        </Text>
        <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 24 }]} onPress={onBack}>
          <Text style={styles.secondaryBtnText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isCompleted = order.status === ORDER_STATUS.COMPLETED;
  const items: any[] = Array.isArray(order.items) ? order.items : [];

  return (
    <View style={styles.container}>
      {/* Carte plein écran en haut */}
      <View style={styles.mapWrap}>
        <DeliveryMap driver={driverPos} destination={destination} />
        <SafeAreaView edges={['top']} style={styles.mapHeader} pointerEvents="box-none">
          <TouchableOpacity style={styles.roundBtn} onPress={onBack} accessibilityLabel="Retour">
            <FontAwesome5 name="arrow-left" size={16} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Course #{shortId(orderId)}</Text>
          </View>
          <View style={{ width: 42 }} />
        </SafeAreaView>
        {(errorMsg || distance !== null || approximate) && (
          <View style={styles.mapBadge}>
            <Text style={styles.mapBadgeText}>
              {errorMsg
                ? `⚠️ ${errorMsg}`
                : approximate
                  ? '📍 Position du client approximative — suivez l’adresse'
                  : `📍 ${distance! < 1 ? `${Math.round(distance! * 1000)} m` : `${distance!.toFixed(1)} km`} à vol d’oiseau`}
            </Text>
          </View>
        )}
      </View>

      {/* Fiche course */}
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
          <View style={styles.handle} />

          <View style={styles.clientRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.clientName}>{getClientName(order)}</Text>
              <Text style={styles.muted}>{phone || 'Pas de numéro'}</Text>
            </View>
            {!!phone && (
              <>
                <TouchableOpacity style={[styles.iconBtn, styles.callBtn]} onPress={call} accessibilityLabel="Appeler le client">
                  <FontAwesome5 name="phone" size={16} color="#4ade80" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, styles.waBtn]} onPress={whatsapp} accessibilityLabel="WhatsApp">
                  <FontAwesome5 name="whatsapp" size={18} color="#25D366" />
                </TouchableOpacity>
              </>
            )}
          </View>

          <TouchableOpacity style={styles.addressCard} onPress={openNavigation} activeOpacity={0.8}>
            <FontAwesome5 name="map-marker-alt" size={16} color="#38bdf8" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.label}>Adresse de livraison</Text>
              <Text style={styles.value}>{address || 'Adresse non spécifiée'}</Text>
              <Text style={styles.link}>Ouvrir la navigation GPS →</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.summary}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Articles</Text>
              {items.length === 0 && <Text style={styles.value}>—</Text>}
              {items.map((it, i) => (
                <Text key={i} style={styles.value} numberOfLines={1}>
                  {it.quantity || 1}× {it.productName || it.name || it.title?.fr || 'Article'}
                </Text>
              ))}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.label}>À encaisser</Text>
              <Text style={styles.amount}>{formatMoney(getAmountToCollect(order), order.currency)}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          {isCompleted ? (
            <View style={styles.doneBanner}>
              <FontAwesome5 name="check-circle" size={18} color="#4ade80" />
              <Text style={styles.doneText}>Course terminée avec succès</Text>
            </View>
          ) : order.status === ORDER_STATUS.ACCEPTED ? (
            <>
              <SwipeButton key="arrived" title="Je suis arrivé chez le client" onConfirm={handleArrived} />
              <TouchableOpacity onPress={handleRelease} style={styles.releaseBtn}>
                <Text style={styles.releaseText}>Abandonner la course</Text>
              </TouchableOpacity>
            </>
          ) : (
            <SwipeButton key="delivered" title="Livré & encaissé" color="#22c55e" onConfirm={handleDelivered} />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b061c' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#9ca3af', fontSize: 14, textAlign: 'center' },
  mapWrap: { flex: 1, minHeight: 260 },
  mapHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(11,6,28,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pill: {
    backgroundColor: 'rgba(11,6,28,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pillText: { color: '#fff', fontWeight: '700' },
  mapBadge: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    backgroundColor: 'rgba(11,6,28,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: '90%',
  },
  mapBadgeText: { color: '#e5e7eb', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  sheet: {
    backgroundColor: '#0b061c',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    maxHeight: '58%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: { width: 48, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 18 },
  clientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  clientName: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 2 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 10, borderWidth: 1 },
  callBtn: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.3)' },
  waBtn: { backgroundColor: 'rgba(37,211,102,0.15)', borderColor: 'rgba(37,211,102,0.3)' },
  addressCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },
  label: { color: '#9ca3af', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  value: { color: '#fff', fontSize: 15, fontWeight: '700' },
  link: { color: '#38bdf8', fontSize: 12, fontWeight: '700', marginTop: 8 },
  summary: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  amount: { color: '#4ade80', fontSize: 20, fontWeight: '800' },
  actions: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  releaseBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  releaseText: { color: '#f87171', fontWeight: '600', fontSize: 14 },
  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderColor: 'rgba(34,197,94,0.3)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  doneText: { color: '#4ade80', fontWeight: '800', marginLeft: 8, fontSize: 16 },
  secondaryBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  secondaryBtnText: { color: '#fff', fontWeight: '700' },
});
