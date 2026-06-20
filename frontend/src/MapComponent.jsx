import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

// Map controller to handle programmatically updating the view/bounds
function MapController({ hotspots, route }) {
  const map = useMap();

  useEffect(() => {
    if (route && route.length > 0) {
      // Fit bounds to the route
      const bounds = L.latLngBounds(route.map(p => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (hotspots && hotspots.length > 0) {
      // Fit bounds to hotspots, limit top 100 to avoid extreme zooms
      const sample = hotspots.slice(0, 100);
      const bounds = L.latLngBounds(sample.map(h => [h.latitude, h.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [hotspots, route, map]);

  return null;
}

export default function MapComponent({ hotspots, patrolRoute, selectedStation }) {
  const DEFAULT_CENTER = [12.9716, 77.5946]; // Bengaluru Center
  const DEFAULT_ZOOM = 12;

  // Color gradient based on congestion score
  const getMarkerColor = (score) => {
    if (score > 100) return '#ef4444'; // Bright Red (Severe)
    if (score > 40) return '#f97316';  // Orange (High)
    if (score > 15) return '#eab308';  // Yellow (Moderate)
    return '#06b6d4';                  // Cyan (Low)
  };

  // Radius based on congestion score
  const getMarkerRadius = (score) => {
    return Math.min(25, Math.max(5, Math.sqrt(score) * 2.0));
  };

  // Custom DivIcon for numbered patrol stops
  const createNumberedIcon = (number, isFirst) => {
    return L.divIcon({
      html: `<div class="patrol-pin ${isFirst ? 'start-pin' : ''}">${number}</div>`,
      className: 'custom-patrol-pin',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  };

  const routeCoordinates = patrolRoute ? patrolRoute.map(p => [p.latitude, p.longitude]) : [];

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer 
        center={DEFAULT_CENTER} 
        zoom={DEFAULT_ZOOM} 
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', background: '#0b0f19' }}
      >
        {/* OpenStreetMap Detailed Street tiles (MapmyIndia Style) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Heatmap/Hotspot Grid Circles */}
        {hotspots && hotspots.map((h, idx) => (
          <CircleMarker
            key={`hotspot-${idx}-${h.latitude}-${h.longitude}-${h.congestion_score}`}
            center={[h.latitude, h.longitude]}
            radius={getMarkerRadius(h.congestion_score)}
            fillColor={getMarkerColor(h.congestion_score)}
            color={getMarkerColor(h.congestion_score)}
            weight={1}
            opacity={0.8}
            fillOpacity={0.4}
            className="hotspot-pulse"
          >
            <Popup className="dark-popup">
              <div className="popup-content">
                <h3>Hotspot Area</h3>
                <p><strong>Coordinates:</strong> {h.latitude.toFixed(4)}, {h.longitude.toFixed(4)}</p>
                <p><strong>Violations Count:</strong> {h.count} incidents</p>
                <p><strong>Congestion Score:</strong> {h.congestion_score.toFixed(1)} pts</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Patrol Route Polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            positions={routeCoordinates}
            color="#a855f7"
            weight={4}
            opacity={0.9}
            dashArray="8, 8"
            className="patrol-route-line"
          />
        )}

        {/* Patrol Route Pins */}
        {patrolRoute && patrolRoute.map((p, idx) => {
          const position = [p.latitude, p.longitude];
          const icon = createNumberedIcon(idx + 1, idx === 0);
          
          return (
            <React.Fragment key={`route-pin-${p.id}-${p.latitude}`}>
              <CircleMarker
                center={position}
                radius={8}
                fillColor="#a855f7"
                color="#ffffff"
                weight={2}
                opacity={1}
                fillOpacity={1}
              />
              <Marker position={position} icon={icon}>
                <Popup className="dark-popup">
                  <div className="popup-content">
                    <span className="badge-purple">PATROL STOP #{idx + 1}</span>
                    <h3>{p.location}</h3>
                    <p><strong>Priority Score:</strong> {p.congestion_score} pts</p>
                    <p><strong>Incident Count:</strong> {p.violation_count} cases</p>
                    <p><strong>Primary Issue:</strong> {p.primary_violation}</p>
                    <p><strong>Primary Vehicle:</strong> {p.primary_vehicle}</p>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        <MapController hotspots={hotspots} route={patrolRoute} />
      </MapContainer>
      
      {/* Map Legend */}
      <div className="map-legend">
        <h4>CONGESTION RISK</h4>
        <div className="legend-item"><span className="dot red"></span> Severe (&gt; 100 pts)</div>
        <div className="legend-item"><span className="dot orange"></span> High (40 - 100 pts)</div>
        <div className="legend-item"><span className="dot yellow"></span> Moderate (15 - 40 pts)</div>
        <div className="legend-item"><span className="dot cyan"></span> Low (&lt; 15 pts)</div>
        {routeCoordinates.length > 0 && (
          <div className="legend-item"><span className="line purple"></span> Patrol Dispatch Route</div>
        )}
      </div>
    </div>
  );
}
