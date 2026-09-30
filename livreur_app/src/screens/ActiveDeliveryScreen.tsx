import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Linking, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLocationTracking } from '../hooks/useLocationTracking';

export default function ActiveDeliveryScreen({ orderId, onBack, userId }: { orderId: string, onBack: () => void, userId: string }) {
  const [order, setOrder] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  
  const { location, errorMsg } = useLocationTracking();

  React.useEffect(() => {
    // Listen to order
    const unsub = onSnapshot(doc(db, 'orders', orderId), (docSnap) => {
      if (docSnap.exists()) {
        setOrder({ id: docSnap.id, ...docSnap.data() });
      }
      setLoading(false);
    });

    return () => unsub();
  }, [orderId]);

  React.useEffect(() => {
    if (location && orderId) {
      updateDoc(doc(db, 'orders', orderId), {
        driverLocation: {
          lat: location.coords.latitude,
          lng: location.coords.longitude
        },
        status: 'in_transit'
      }).catch(console.error);
    }
  }, [location, orderId]);

  const handleCompleteDelivery = async () => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'delivered',
        deliveredAt: new Date()
      });
      alert('Course terminée !');
      onBack();
    } catch (e) {
      console.error(e);
      alert('Erreur lors de la complétion de la course');
    }
  };

  const handleCancelDelivery = async () => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'cancelled',
        cancelledAt: new Date()
      });

      // Refund stock via API
      if (order?.items && order.items.length > 0) {
        const item = order.items[0];
        if (item.productId) {
          const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://rayons.net';
          await fetch(`${apiUrl}/api/orders/update-stock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: item.productId,
              quantity: item.quantity,
              action: 'increment'
            })
          }).catch(console.error);
        }
      }

      alert('Course annulée !');
      onBack();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'annulation de la course");
    }
  };

  const openMap = () => {
    if (!order) return;
    const address = order.clientAddress || 'Kinshasa'; // fallback
    const url = Platform.select({
      ios: `maps:0,0?q=${address}`,
      android: `geo:0,0?q=${address}`,
    });
    if (url) Linking.openURL(url);
  };

  if (loading || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{color: 'white', textAlign: 'center', marginTop: 20}}>Chargement de la course...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <FontAwesome5 name="arrow-left" size={18} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.title}>Course #{orderId.substring(0, 6).toUpperCase()}</Text>
      </View>

      <View style={styles.mapPlaceholder}>
        <View style={styles.mapGrid} />
        {/* Fake route line */}
        <View style={styles.routeLine} />
        
        <FontAwesome5 name="map-marker-alt" size={40} color="#ef4444" style={styles.marker} />
        <View style={styles.driverMarker}>
           <FontAwesome5 name="car" size={16} color="#ffffff" />
        </View>
        <Text style={styles.mapText}>Suivi GPS Actif</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Détails de Livraison</Text>
        <Text style={styles.infoText}>{order.clientName || 'Client Inconnu'}</Text>
        <Text style={styles.infoText}>{order.clientPhone || 'Pas de numéro'}</Text>
        <Text style={styles.infoText}>{order.clientAddress}</Text>

        <TouchableOpacity style={styles.actionBtn} onPress={openMap}>
          <FontAwesome5 name="directions" size={18} color="#38bdf8" />
          <Text style={styles.actionBtnText}>Ouvrir le GPS</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelDelivery}>
          <Text style={styles.cancelBtnText}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.completeBtn} onPress={handleCompleteDelivery}>
          <Text style={styles.completeBtnText}>Marquer Livré</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b061c',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    margin: 16,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mapGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
  },
  routeLine: {
    position: 'absolute',
    width: 2,
    height: 100,
    backgroundColor: '#38bdf8',
    transform: [{ rotate: '45deg'}],
    opacity: 0.5,
  },
  marker: {
    position: 'absolute',
    top: '30%',
    left: '40%',
  },
  driverMarker: {
    position: 'absolute',
    top: '60%',
    left: '60%',
    backgroundColor: '#38bdf8',
    padding: 12,
    borderRadius: 24,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  mapText: {
    color: '#9ca3af',
    marginTop: 150,
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 14,
    textTransform: 'uppercase',
    marginBottom: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  infoText: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 6,
    fontWeight: '600',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 14,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  actionBtnText: {
    color: '#38bdf8',
    marginLeft: 8,
    fontWeight: 'bold',
    fontSize: 16,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  cancelBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    flex: 1,
    marginRight: 8,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  cancelBtnText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  completeBtn: {
    backgroundColor: '#22c55e',
    flex: 2,
    marginLeft: 8,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  completeBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
