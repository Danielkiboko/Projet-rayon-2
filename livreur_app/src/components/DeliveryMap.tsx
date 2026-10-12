import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import type { LatLng } from '../lib/orders';

type Props = {
  driver: LatLng | null;
  destination: LatLng | null;
};

/**
 * Carte réelle basée sur Leaflet + tuiles OpenStreetMap/CARTO (même moteur que la page de suivi client web).
 * Pas de clé Google Maps requise. Les marqueurs sont mis à jour sans recharger la carte.
 */
const MAP_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#0b061c}
  .leaflet-control-attribution{font-size:8px;background:rgba(11,6,28,.6)!important;color:#6b7280}
  .leaflet-control-attribution a{color:#9ca3af}
  .pin{display:flex;align-items:center;justify-content:center;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.5)}
  .driver{width:22px;height:22px;background:#38bdf8;box-shadow:0 0 0 8px rgba(56,189,248,.25),0 4px 14px rgba(0,0,0,.5)}
  .dest{width:26px;height:26px;background:#22c55e;font:700 13px sans-serif;color:#fff}
</style></head><body><div id="map"></div><script>
  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([-4.3224, 15.3070], 13);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);
  var driverIcon = L.divIcon({ className: '', html: '<div class="pin driver"></div>', iconSize: [22,22], iconAnchor: [11,11] });
  var destIcon = L.divIcon({ className: '', html: '<div class="pin dest">C</div>', iconSize: [26,26], iconAnchor: [13,13] });
  var driverMarker = null, destMarker = null, line = null, fitted = false;
  window.updateMap = function (d, c) {
    if (d) { if (!driverMarker) driverMarker = L.marker([d.lat, d.lng], { icon: driverIcon }).addTo(map); else driverMarker.setLatLng([d.lat, d.lng]); }
    if (c) { if (!destMarker) destMarker = L.marker([c.lat, c.lng], { icon: destIcon }).addTo(map); else destMarker.setLatLng([c.lat, c.lng]); }
    if (d && c) {
      var pts = [[d.lat, d.lng], [c.lat, c.lng]];
      if (!line) line = L.polyline(pts, { color: '#38bdf8', weight: 4, opacity: .8, dashArray: '8,10' }).addTo(map); else line.setLatLngs(pts);
      if (!fitted) { map.fitBounds(pts, { padding: [50, 50], maxZoom: 16 }); fitted = true; }
    } else if (!fitted && (d || c)) { var p = d || c; map.setView([p.lat, p.lng], 15); }
  };
  window.ReactNativeWebView && window.ReactNativeWebView.postMessage('ready');
</script></body></html>`;

export default function DeliveryMap({ driver, destination }: Props) {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const source = useMemo(() => ({ html: MAP_HTML, baseUrl: 'https://rayons.net' }), []);

  useEffect(() => {
    if (!ready) return;
    ref.current?.injectJavaScript(
      `window.updateMap && window.updateMap(${JSON.stringify(driver)}, ${JSON.stringify(destination)}); true;`
    );
  }, [ready, driver?.lat, driver?.lng, destination?.lat, destination?.lng]);

  if (Platform.OS === 'web') {
    return <View style={[styles.map, styles.fallback]} />;
  }

  return (
    <View style={styles.map}>
      <WebView
        ref={ref}
        source={source}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onMessage={(e) => e.nativeEvent.data === 'ready' && setReady(true)}
        style={styles.webview}
      />
      {!ready && (
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator color="#38bdf8" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: '#0b061c', overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: '#0b061c' },
  fallback: { backgroundColor: '#111827' },
  loader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b061c' },
});
