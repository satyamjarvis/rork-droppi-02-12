import { useMemo, useRef, useCallback, useState } from "react";
import { StyleSheet, Text, View, Platform, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { WebView } from "react-native-webview";
import { MapPin, Navigation, RefreshCw, Users } from "lucide-react-native";

import Colors from "@/constants/colors";
import { User } from "@/types/models";

type CourierTrackingMapProps = {
  couriers: User[];
  fullScreen?: boolean;
};

type CourierMapData = {
  id: string;
  name: string;
  vehicle: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
};

export function CourierTrackingMap({ couriers, fullScreen = false }: CourierTrackingMapProps) {
  const webViewRef = useRef<WebView>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);

  const availableCouriersWithLocation = useMemo<CourierMapData[]>(() => {
    return couriers
      .filter((courier) => {
        const isAvailable = courier.courierProfile?.isAvailable ?? false;
        const hasLocation =
          courier.courierProfile?.currentLocation?.latitude !== undefined &&
          courier.courierProfile?.currentLocation?.longitude !== undefined;
        return isAvailable && hasLocation;
      })
      .map((courier) => ({
        id: courier.id,
        name: courier.name,
        vehicle: courier.courierProfile?.vehicle ?? "לא צוין",
        latitude: courier.courierProfile!.currentLocation!.latitude,
        longitude: courier.courierProfile!.currentLocation!.longitude,
        updatedAt: courier.courierProfile!.currentLocation!.updatedAt ?? new Date().toISOString(),
      }));
  }, [couriers]);

  const formatLastUpdate = (updatedAt: string | undefined): string => {
    if (!updatedAt) return "לא ידוע";
    try {
      const date = new Date(updatedAt);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);

      if (diffMinutes < 1) return "עכשיו";
      if (diffMinutes < 60) return `לפני ${diffMinutes} דק׳`;

      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `לפני ${diffHours} שע׳`;

      return date.toLocaleDateString("he-IL", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "לא ידוע";
    }
  };

  const defaultCenter = useMemo(() => {
    if (availableCouriersWithLocation.length === 0) {
      return { lat: 32.0853, lng: 34.7818 };
    }
    const avgLat =
      availableCouriersWithLocation.reduce((sum, c) => sum + c.latitude, 0) /
      availableCouriersWithLocation.length;
    const avgLng =
      availableCouriersWithLocation.reduce((sum, c) => sum + c.longitude, 0) /
      availableCouriersWithLocation.length;
    return { lat: avgLat, lng: avgLng };
  }, [availableCouriersWithLocation]);

  const getMapHtml = useCallback((useGoogleMaps: boolean) => {
    const safeCouriers = availableCouriersWithLocation.map(c => ({
      ...c,
      name: c.name.replace(/[\\"']/g, ''),
      vehicle: c.vehicle.replace(/[\\"']/g, ''),
    }));
    const couriersJson = JSON.stringify(safeCouriers)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026");
    
    if (useGoogleMaps) {
      return `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://maps.googleapis.com/maps/api/js?key=&libraries=marker"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #map { width: 100%; height: 100%; }
    .courier-dot {
      width: 12px;
      height: 12px;
      background: #3b82f6;
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(59, 130, 246, 0.5);
    }
    .info-window {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      direction: rtl;
      text-align: right;
      padding: 8px;
    }
    .info-name { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
    .info-vehicle { font-size: 12px; color: #64748b; margin-bottom: 4px; }
    .info-time { font-size: 11px; color: #94a3b8; }
    .no-couriers-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255,255,255,0.95);
      padding: 20px 28px;
      border-radius: 16px;
      text-align: center;
      z-index: 1000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #64748b;
      direction: rtl;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      var couriers = ${couriersJson};
      var centerLat = ${defaultCenter.lat};
      var centerLng = ${defaultCenter.lng};
      
      var map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: centerLat, lng: centerLng },
        zoom: couriers.length > 0 ? 13 : 11,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });

      if (couriers.length === 0) {
        var overlay = document.createElement('div');
        overlay.className = 'no-couriers-overlay';
        overlay.textContent = 'אין שליחים זמינים עם מיקום פעיל';
        document.body.appendChild(overlay);
      } else {
        var bounds = new google.maps.LatLngBounds();
        var infoWindow = new google.maps.InfoWindow();
        
        couriers.forEach(function(courier) {
          var position = { lat: courier.latitude, lng: courier.longitude };
          bounds.extend(position);

          var markerDiv = document.createElement('div');
          markerDiv.className = 'courier-dot';

          var marker = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: position,
            content: markerDiv,
            title: courier.name
          });

          var updatedAt = new Date(courier.updatedAt);
          var now = new Date();
          var diffMs = now - updatedAt;
          var diffMin = Math.floor(diffMs / 60000);
          var timeText = diffMin < 1 ? 'עכשיו' : 
                        diffMin < 60 ? 'לפני ' + diffMin + ' דק׳' :
                        'לפני ' + Math.floor(diffMin / 60) + ' שע׳';

          marker.addListener('click', function() {
            infoWindow.setContent(
              '<div class="info-window">' +
                '<div class="info-name">' + courier.name + '</div>' +
                '<div class="info-vehicle">' + courier.vehicle + '</div>' +
                '<div class="info-time">עדכון: ' + timeText + '</div>' +
              '</div>'
            );
            infoWindow.open(map, marker);
          });
        });

        if (couriers.length > 1) {
          map.fitBounds(bounds, { padding: 40 });
        }
      }

      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('map_loaded');
    })();
  </script>
</body>
</html>
      `;
    }

    // Use Carto Voyager tiles - closest free alternative to Apple Maps style
    return `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #f5f5f7; }
    #map { width: 100%; height: 100%; }
    .courier-popup {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif;
      direction: rtl;
      text-align: right;
      min-width: 140px;
    }
    .courier-popup-name {
      font-size: 14px;
      font-weight: 600;
      color: #1d1d1f;
      margin-bottom: 4px;
    }
    .courier-popup-vehicle {
      font-size: 12px;
      color: #86868b;
      margin-bottom: 4px;
    }
    .courier-popup-time {
      font-size: 11px;
      color: #aeaeb2;
    }
    .courier-marker {
      width: 12px;
      height: 12px;
      background: #007AFF;
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0, 122, 255, 0.4);
    }
    .no-couriers-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255,255,255,0.97);
      padding: 20px 28px;
      border-radius: 14px;
      text-align: center;
      z-index: 1000;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
    .no-couriers-text {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
      font-size: 14px;
      color: #86868b;
      direction: rtl;
    }
    .leaflet-popup-content-wrapper {
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    }
    .leaflet-popup-content {
      margin: 12px 14px;
    }
    .leaflet-popup-tip {
      box-shadow: none;
    }
    .leaflet-control-zoom {
      border: none !important;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1) !important;
      border-radius: 10px !important;
      overflow: hidden;
    }
    .leaflet-control-zoom a {
      color: #007AFF !important;
      background: rgba(255,255,255,0.95) !important;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: none !important;
      width: 36px !important;
      height: 36px !important;
      line-height: 36px !important;
      font-size: 18px !important;
    }
    .leaflet-control-zoom a:hover {
      background: rgba(245,245,247,0.95) !important;
    }
    .leaflet-control-attribution {
      display: none;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      var couriers = ${couriersJson};
      var centerLat = ${defaultCenter.lat};
      var centerLng = ${defaultCenter.lng};
      
      var map = L.map('map', {
        center: [centerLat, centerLng],
        zoom: couriers.length > 0 ? 14 : 12,
        zoomControl: true
      });

      // Carto Voyager - clean, Apple Maps-like style
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      if (couriers.length === 0) {
        var overlay = document.createElement('div');
        overlay.className = 'no-couriers-overlay';
        overlay.innerHTML = '<div class="no-couriers-text">אין שליחים זמינים עם מיקום פעיל</div>';
        document.body.appendChild(overlay);
      } else {
        var bounds = [];
        
        couriers.forEach(function(courier) {
          var updatedAt = new Date(courier.updatedAt);
          var now = new Date();
          var diffMs = now - updatedAt;
          var diffMin = Math.floor(diffMs / 60000);
          var timeText = diffMin < 1 ? 'עכשיו' : 
                        diffMin < 60 ? 'לפני ' + diffMin + ' דק׳' :
                        'לפני ' + Math.floor(diffMin / 60) + ' שע׳';

          var courierIcon = L.divIcon({
            className: '',
            html: '<div class="courier-marker"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6],
            popupAnchor: [0, -8]
          });

          var marker = L.marker([courier.latitude, courier.longitude], {
            icon: courierIcon,
            title: courier.name
          }).addTo(map);

          marker.bindPopup(
            '<div class="courier-popup">' +
              '<div class="courier-popup-name">' + courier.name + '</div>' +
              '<div class="courier-popup-vehicle">' + courier.vehicle + '</div>' +
              '<div class="courier-popup-time">עדכון: ' + timeText + '</div>' +
            '</div>'
          );

          bounds.push([courier.latitude, courier.longitude]);
        });

        if (bounds.length > 1) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      }

      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('map_loaded');
    })();
  </script>
</body>
</html>
    `;
  }, [availableCouriersWithLocation, defaultCenter]);

  const mapHtml = useMemo(() => {
    const useGoogleMaps = Platform.OS === "android" || Platform.OS === "web";
    return getMapHtml(useGoogleMaps);
  }, [getMapHtml]);

  const handleRefresh = useCallback(() => {
    setIsMapLoading(true);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  }, []);

  const handleWebViewMessage = useCallback(() => {
    setIsMapLoading(false);
  }, []);

  if (availableCouriersWithLocation.length === 0) {
    return (
      <View style={[styles.emptyContainer, fullScreen && styles.fullScreenEmpty]}>
        <View style={styles.emptyIconContainer}>
          <Users color={Colors.light.secondaryText} size={32} />
        </View>
        <Text style={styles.emptyText}>אין שליחים זמינים עם מיקום פעיל</Text>
        <Text style={styles.emptySubtext}>
          שליחים יופיעו על המפה כאשר הם זמינים ומשתפים מיקום
        </Text>
      </View>
    );
  }

  if (fullScreen) {
    return (
      <View style={styles.fullScreenContainer} testID="courier-tracking-map-fullscreen">
        <View style={styles.fullScreenMapContainer}>
          {isMapLoading && (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator color={Colors.light.tint} size="large" />
              <Text style={styles.mapLoadingText}>טוען מפה...</Text>
            </View>
          )}
          {Platform.OS === "web" ? (
            <iframe
              srcDoc={mapHtml}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
              }}
              onLoad={() => setIsMapLoading(false)}
            />
          ) : (
            <WebView
              ref={webViewRef}
              source={{ html: mapHtml }}
              style={styles.webView}
              scrollEnabled={false}
              javaScriptEnabled
              domStorageEnabled
              onMessage={handleWebViewMessage}
              onLoadEnd={() => setIsMapLoading(false)}
            />
          )}
        </View>
        
        <View style={styles.fullScreenBottomPanel}>
          <View style={styles.fullScreenPanelHeader}>
            <View style={styles.mapHeaderLeft}>
              <Navigation color={Colors.light.tint} size={18} />
              <Text style={styles.mapHeaderText}>{availableCouriersWithLocation.length} שליחים זמינים</Text>
            </View>
            <Pressable onPress={handleRefresh} style={styles.mapActionButton}>
              <RefreshCw color={Colors.light.tint} size={16} />
            </Pressable>
          </View>
          <ScrollView 
            style={styles.fullScreenCourierListScroll}
            contentContainerStyle={styles.fullScreenCourierList}
            showsVerticalScrollIndicator={true}
            scrollEnabled={true}
            bounces={true}
          >
            {availableCouriersWithLocation.map((courier) => (
              <View
                key={courier.id}
                style={styles.fullScreenCourierCard}
                testID={`courier-marker-${courier.id}`}
              >
                <View style={styles.courierMarkerIcon} />
                <View style={styles.fullScreenCourierInfo}>
                  <Text style={styles.fullScreenCourierName}>{courier.name}</Text>
                  <Text style={styles.fullScreenCourierVehicle}>{courier.vehicle}</Text>
                </View>
                <Text style={styles.fullScreenCourierTime}>
                  {formatLastUpdate(courier.updatedAt)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="courier-tracking-map">
      <View style={styles.mapHeader}>
        <View style={styles.mapHeaderLeft}>
          <Navigation color={Colors.light.tint} size={18} />
          <Text style={styles.mapHeaderText}>מפת שליחים בזמן אמת</Text>
        </View>
        <Pressable onPress={handleRefresh} style={styles.mapActionButton}>
          <RefreshCw color={Colors.light.tint} size={16} />
        </Pressable>
      </View>

      <View style={styles.mapContainer}>
        {isMapLoading && (
          <View style={styles.mapLoadingOverlay}>
            <ActivityIndicator color={Colors.light.tint} size="large" />
            <Text style={styles.mapLoadingText}>טוען מפה...</Text>
          </View>
        )}
        {Platform.OS === "web" ? (
          <iframe
            srcDoc={mapHtml}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              borderRadius: 16,
            }}
            onLoad={() => setIsMapLoading(false)}
          />
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: mapHtml }}
            style={styles.webView}
            scrollEnabled={false}
            javaScriptEnabled
            domStorageEnabled
            onMessage={handleWebViewMessage}
            onLoadEnd={() => setIsMapLoading(false)}
          />
        )}
      </View>

      <View style={styles.courierListContainer}>
        <Text style={styles.listTitle}>
          {availableCouriersWithLocation.length} שליחים זמינים
        </Text>
        {availableCouriersWithLocation.map((courier) => (
          <View
            key={courier.id}
            style={styles.courierLocationCard}
            testID={`courier-marker-${courier.id}`}
          >
            <View style={styles.courierLocationHeader}>
              <View style={styles.courierMarkerIcon} />
              <View style={styles.courierLocationInfo}>
                <Text style={styles.courierLocationName}>{courier.name}</Text>
                <Text style={styles.courierLocationVehicle}>{courier.vehicle}</Text>
              </View>
            </View>
            <View style={styles.courierLocationDetails}>
              <View style={styles.locationCoordRow}>
                <MapPin color={Colors.light.tint} size={14} />
                <Text style={styles.locationCoordText}>
                  {courier.latitude.toFixed(5)}, {courier.longitude.toFixed(5)}
                </Text>
              </View>
              <Text style={styles.locationUpdateText}>
                עדכון: {formatLastUpdate(courier.updatedAt)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  mapHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  mapHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mapHeaderText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },

  mapActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapContainer: {
    height: 280,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.15)",
  },
  fullScreenContainer: {
    flex: 1,
  },
  fullScreenMapContainer: {
    flex: 1,
    backgroundColor: "#e5e7eb",
  },
  fullScreenBottomPanel: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    height: 260,
  },
  fullScreenPanelHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  fullScreenCourierListScroll: {
    flex: 1,
  },
  fullScreenCourierList: {
    gap: 8,
    paddingBottom: 8,
  },
  fullScreenCourierCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#f8faff",
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  fullScreenCourierInfo: {
    flex: 1,
    alignItems: "flex-end",
    gap: 2,
  },
  fullScreenCourierName: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  fullScreenCourierVehicle: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  fullScreenCourierTime: {
    fontSize: 11,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  fullScreenEmpty: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 0,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    gap: 12,
  },
  mapLoadingText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  courierListContainer: {
    backgroundColor: "#f8faff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.12)",
    overflow: "hidden",
    padding: 14,
    gap: 10,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
    textAlign: "right",
  },
  courierLocationCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.08)",
  },
  courierLocationHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  courierMarkerIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
    borderWidth: 2,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  courierLocationInfo: {
    flex: 1,
    alignItems: "flex-end",
    gap: 2,
  },
  courierLocationName: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  courierLocationVehicle: {
    fontSize: 13,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  courierLocationDetails: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 52,
  },
  locationCoordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationCoordText: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  locationUpdateText: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  emptyContainer: {
    backgroundColor: "#f8faff",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.12)",
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(100, 116, 139, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
    textAlign: "center",
    lineHeight: 20,
  },
});
