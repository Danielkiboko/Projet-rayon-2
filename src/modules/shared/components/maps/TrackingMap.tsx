import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

// Fix leaflet default icons issue with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Custom Icons
const driverIcon = new L.Icon({
  iconUrl: '/driver-icon.png', // Fallback to default if this doesn't exist yet
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const clientIcon = new L.Icon({
  iconUrl: '/client-icon.png', // Fallback to default
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Component to handle auto-centering when locations update
function MapUpdater({ clientLocation, driverLocation }: { clientLocation: any, driverLocation: any }) {
  const map = useMap();
  
  useEffect(() => {
    if (clientLocation && driverLocation) {
      const bounds = L.latLngBounds(
        [clientLocation.lat, clientLocation.lng],
        [driverLocation.lat, driverLocation.lng]
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (clientLocation) {
      map.setView([clientLocation.lat, clientLocation.lng], 15);
    }
  }, [clientLocation, driverLocation, map]);
  
  return null;
}

export default function TrackingMap({ clientLocation, driverLocation }: { clientLocation: any, driverLocation: any }) {
  const defaultCenter = [-4.322447, 15.307045]; // Kinshasa center

  return (
    <MapContainer 
      center={clientLocation ? [clientLocation.lat, clientLocation.lng] : defaultCenter as any} 
      zoom={13} 
      scrollWheelZoom={true}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {clientLocation && (
        <Marker position={[clientLocation.lat, clientLocation.lng]} icon={clientIcon}>
          <Popup>Votre position</Popup>
        </Marker>
      )}

      {driverLocation && (
        <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon}>
          <Popup>Votre livreur</Popup>
        </Marker>
      )}

      {clientLocation && driverLocation && (
        <Polyline 
          positions={[
            [driverLocation.lat, driverLocation.lng],
            [clientLocation.lat, clientLocation.lng]
          ]} 
          color="#f97316" 
          weight={4} 
          dashArray="10, 10" 
        />
      )}
      
      <MapUpdater clientLocation={clientLocation} driverLocation={driverLocation} />
    </MapContainer>
  );
}
