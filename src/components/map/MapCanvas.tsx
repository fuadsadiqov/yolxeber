"use client";

/**
 * Leaflet xəritəsi. Brauzer API-lərinə toxunduğu üçün yalnız müştəridə yüklənir:
 * `const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), { ssr: false })`.
 */
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import L from "leaflet";
import { useEffect, useImperativeHandle, useRef } from "react";
import { useTheme } from "@/components/layout/theme";
import type { CategoryKey } from "@/lib/categories";
import type { LatLng, MapReport } from "@/lib/types";
import { meHtml, pinHtml } from "./pins";

export type MapView = {
  center: LatLng;
  zoom: number;
  bbox: { west: number; south: number; east: number; north: number };
};

export type MapHandle = {
  flyTo: (p: LatLng, zoom?: number) => void;
  getCenter: () => LatLng;
  zoomIn: () => void;
  zoomOut: () => void;
};

type Props = {
  center: LatLng;
  zoom?: number;
  /** false — mini xəritə: sürüşdürmə/zoom yoxdur */
  interactive?: boolean;
  reports?: MapReport[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Hərəkət bitəndə (moveend) — görünən ərazi */
  onViewChange?: (v: MapView) => void;
  /** İstifadəçinin mövqeyi (mavi nöqtə) */
  me?: LatLng | null;
  /** Tək statik pin (mini xəritə) */
  pin?: { lat: number; lng: number; category: CategoryKey } | null;
  /** Xəritə mərkəzində radius dairəsi (xəbərdarlıq zonası redaktoru) */
  centerCircleM?: number | null;
  ref?: React.Ref<MapHandle>;
  className?: string;
};

// Default: OpenStreetMap plitələri. Tünd temada ayrıca plitə URL-i verilməyibsə, işıqlı plitələr CSS filtri ilə
// tündləşdirilir (globals.css → .yx-dark-tiles). Yüksək trafikdə öz plitə serveri/provayder env ilə qoşulmalıdır.
const TILE_LIGHT = process.env.NEXT_PUBLIC_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_DARK = process.env.NEXT_PUBLIC_TILE_URL_DARK || "";
const ATTRIBUTION = process.env.NEXT_PUBLIC_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function viewOf(map: L.Map): MapView {
  const b = map.getBounds();
  const c = map.getCenter();
  return {
    center: { lat: c.lat, lng: c.lng },
    zoom: map.getZoom(),
    bbox: { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
  };
}

export default function MapCanvas({
  center,
  zoom = 14,
  interactive = true,
  reports,
  selectedId,
  onSelect,
  onViewChange,
  me,
  pin,
  centerCircleM,
  ref,
  className,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef(new Map<string, { marker: L.Marker; key: string }>());
  const meRef = useRef<L.Marker | null>(null);
  const pinRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const cb = useRef({ onSelect, onViewChange });
  cb.current = { onSelect, onViewChange };
  const { isDark } = useTheme();

  // Xəritənin yaradılması (bir dəfə)
  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: false,
      attributionControl: true,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
    });
    map.attributionControl.setPrefix(false);
    mapRef.current = map;
    const markers = markersRef.current;

    const emit = () => cb.current.onViewChange?.(viewOf(map));
    map.on("moveend", emit);
    map.on("click", () => cb.current.onSelect?.(null));
    // İlk görünüş: layout hesablandıqdan sonra
    requestAnimationFrame(() => {
      map.invalidateSize();
      emit();
    });

    // Konteyner ölçüsü dəyişəndə (panel açılıb-bağlananda) xəritəni yeniləyirik
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el.current);

    let cancelled = false;
    if (reports) {
      // markercluster qlobal L gözləyir
      (window as unknown as { L: typeof L }).L = L;
      import("leaflet.markercluster").then(() => {
        if (cancelled) return;
        const group = L.markerClusterGroup({
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          maxClusterRadius: 48,
          chunkedLoading: true,
          iconCreateFunction: (c) => {
            const n = c.getChildCount();
            const size = n < 10 ? 40 : n < 100 ? 46 : 54;
            return L.divIcon({
              html: `<div class="yx-cluster" style="width:${size}px;height:${size}px">${n}</div>`,
              className: "",
              iconSize: [size, size],
            });
          },
        });
        map.addLayer(group);
        clusterRef.current = group;
        // Pinlər bu effektdən sonra gələ bilər — sinxronizasiya effektini işə salmaq üçün hadisə
        map.fire("yx:cluster-ready");
      });
    }

    return () => {
      cancelled = true;
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      markers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Plitə qatı — tema dəyişəndə əvəzlənir
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tilesRef.current?.remove();
    const useDarkUrl = isDark && !!TILE_DARK;
    tilesRef.current = L.tileLayer(useDarkUrl ? TILE_DARK : TILE_LIGHT, {
      attribution: ATTRIBUTION,
      maxZoom: 19,
      className: isDark && !useDarkUrl ? "yx-dark-tiles" : "",
    }).addTo(map);
  }, [isDark]);

  // Bildiriş pinləri — yalnız dəyişənlər əlavə/silinir (diff), hamısı yenidən yaradılmır
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !reports) return;
    const sync = () => {
      const group = clusterRef.current;
      if (!group) return;
      const existing = markersRef.current;
      const next = new Set<string>();
      const toAdd: L.Marker[] = [];
      for (const r of reports) {
        next.add(r.id);
        const selected = r.id === selectedId;
        const key = `${r.category}|${r.status}|${selected}`;
        const cur = existing.get(r.id);
        if (cur && cur.key === key) continue;
        if (cur) group.removeLayer(cur.marker);
        const icon = L.divIcon({
          html: pinHtml(r.category, { outdated: r.status === "outdated", selected }),
          className: "",
          iconSize: selected ? [52, 52] : [42, 42],
          iconAnchor: selected ? [26, 26] : [21, 21],
        });
        const m = L.marker([r.lat, r.lng], {
          icon,
          title: r.title,
          keyboard: true,
          zIndexOffset: selected ? 1000 : r.status === "outdated" ? -100 : 0,
        });
        m.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          cb.current.onSelect?.(r.id);
        });
        existing.set(r.id, { marker: m, key });
        toAdd.push(m);
      }
      group.addLayers(toAdd);
      for (const [id, { marker }] of existing) {
        if (!next.has(id)) {
          group.removeLayer(marker);
          existing.delete(id);
        }
      }
    };
    sync();
    map.on("yx:cluster-ready", sync);
    return () => {
      map.off("yx:cluster-ready", sync);
    };
  }, [reports, selectedId]);

  // İstifadəçinin mövqeyi
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!me) {
      meRef.current?.remove();
      meRef.current = null;
      return;
    }
    if (!meRef.current) {
      meRef.current = L.marker([me.lat, me.lng], {
        icon: L.divIcon({ html: meHtml, className: "", iconSize: [32, 32] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: -200,
      }).addTo(map);
    } else meRef.current.setLatLng([me.lat, me.lng]);
  }, [me]);

  // Statik pin (mini xəritə)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pinRef.current?.remove();
    pinRef.current = null;
    if (pin) {
      pinRef.current = L.marker([pin.lat, pin.lng], {
        icon: L.divIcon({ html: pinHtml(pin.category, { small: true }), className: "", iconSize: [38, 38] }),
        interactive: false,
      }).addTo(map);
    }
  }, [pin]);

  // Mərkəzdə radius dairəsi — xəritə hərəkət etdikcə mərkəzlə birlikdə
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!centerCircleM) {
      circleRef.current?.remove();
      circleRef.current = null;
      return;
    }
    if (!circleRef.current) {
      circleRef.current = L.circle(map.getCenter(), {
        radius: centerCircleM,
        color: "#00A86B",
        weight: 1.5,
        opacity: 0.6,
        fillColor: "#00A86B",
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(map);
    } else circleRef.current.setRadius(centerCircleM);
    const follow = () => circleRef.current?.setLatLng(map.getCenter());
    map.on("move", follow);
    return () => {
      map.off("move", follow);
    };
  }, [centerCircleM]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (p, z) => mapRef.current?.flyTo([p.lat, p.lng], z ?? Math.max(mapRef.current.getZoom(), 15), { duration: 0.6 }),
      getCenter: () => {
        const c = mapRef.current?.getCenter();
        return c ? { lat: c.lat, lng: c.lng } : center;
      },
      zoomIn: () => mapRef.current?.zoomIn(),
      zoomOut: () => mapRef.current?.zoomOut(),
    }),
    [center],
  );

  return <div ref={el} className={className ?? "absolute inset-0"} role="region" aria-label="Xəritə" />;
}
