"use client";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
export default function PlaceMap({ rows }: { rows: Record<string, string | number>[] }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | undefined;
    void import("leaflet").then((L) => {
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      const bounds: L.LatLngTuple[] = [];
      rows.forEach((r, i) => {
        const lat = Number(r.위도),
          lng = Number(r.경도);
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180
        )
          return;
        bounds.push([lat, lng]);
        const label = document.createElement("span");
        label.textContent = String(r.이름);
        L.marker([lat, lng], {
          icon: L.divIcon({
            className: "hub-map-marker",
            html: `<b>${i + 1}</b>`,
            iconSize: [28, 34],
            iconAnchor: [14, 34],
          }),
        })
          .addTo(map!)
          .bindPopup(label);
      });
      if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [rows]);
  return (
    <>
      <div className="place-map" ref={el} aria-label="검색 장소 지도" />
      <p className="field-help">
        OpenStreetMap 지도 · 타일 연결이 제한되면 아래 공식 지도 링크를 사용하세요.
      </p>
    </>
  );
}
