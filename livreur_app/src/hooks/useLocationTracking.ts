import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';

type Options = {
  /** Appelé à chaque nouvelle position (ex : publication vers Firestore) */
  onUpdate?: (loc: Location.LocationObject) => void;
  enabled?: boolean;
};

export function useLocationTracking({ onUpdate, enabled = true }: Options = {}) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) return;
    let watchSubscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      try {
        // 1. Demander la permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg("Autorisez l'accès à la position pour que le client puisse suivre la livraison.");
          return;
        }

        // 2. Position immédiate (dernière connue d'abord pour un affichage rapide)
        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) {
          setLocation(last);
          onUpdateRef.current?.(last);
        }
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (cancelled) return;
        setLocation(current);
        onUpdateRef.current?.(current);

        // 3. Suivi en temps réel (tous les 15 m, au plus toutes les 5 s)
        watchSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 5000 },
          (newLocation) => {
            setLocation(newLocation);
            onUpdateRef.current?.(newLocation);
          }
        );
        if (cancelled) watchSubscription.remove();
      } catch (e: any) {
        setErrorMsg("GPS indisponible. Activez la localisation de votre téléphone.");
      }
    })();

    return () => {
      cancelled = true;
      watchSubscription?.remove();
    };
  }, [enabled]);

  return { location, errorMsg };
}
