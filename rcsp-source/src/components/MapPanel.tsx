import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import type { SiteFacts } from "../engine/types";
import { centroid } from "../services/gis";

function toLatLngs(rings: number[][][]): L.LatLngExpression[][] {
  return rings.map((ring) => ring.map(([lon, lat]) => [lat, lon]));
}

export function MapPanel({ facts }: { facts: SiteFacts }) {
  const holder = useRef<HTMLDivElement>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const rings = facts.parcel?.rings;
  const geocode = facts.geocode;
  const hasShape = Boolean(rings && rings.length && rings[0]?.length);
  const focusKey = facts.parcel
    ? `${facts.dataOrigin}:${facts.parcel.folio}`
    : geocode
      ? `${geocode.lat},${geocode.lon}`
      : "";

  useEffect(() => {
    if (!holder.current || !focusKey) return;
    const here = rings && rings[0]?.length ? centroid(rings) : geocode ? [geocode.lon, geocode.lat] : null;
    if (!here) return;
    const map = L.map(holder.current, { scrollWheelZoom: false }).setView([here[1], here[0]], hasShape ? 18 : 15);
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    });
    let alive = true;
    let failures = 0;
    tiles.on("tileerror", () => {
      if (!alive) return;
      failures += 1;
      if (failures >= 3) setTilesFailed(true);
    });
    tiles.addTo(map);
    if (rings && hasShape) {
      const polygon = L.polygon(toLatLngs(rings), {
        color: "#14352c",
        weight: 2,
        fillColor: "#1d4e3e",
        fillOpacity: 0.28,
      });
      polygon.addTo(map);
      map.fitBounds(polygon.getBounds(), { padding: [18, 18] });
    }
    if (geocode) {
      L.circleMarker([geocode.lat, geocode.lon], {
        radius: 6,
        color: "#8d4b24",
        weight: 2,
        fillColor: "#e7d7b8",
        fillOpacity: 1,
      }).addTo(map);
    }
    const timer = window.setTimeout(() => {
      if (alive) map.invalidateSize();
    }, 150);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      try {
        map.stop();
        map.off();
        map.remove();
      } catch (cause) {
        console.error("rcsp-map", cause instanceof Error ? cause.message : "remove_failed");
      }
    };
  }, [focusKey, geocode, hasShape, rings]);

  if (!focusKey) {
    return (
      <div className="schematic">
        <p className="map-kicker">No location to draw</p>
        <p>Neither a county parcel polygon nor a geocoder point came back.</p>
      </div>
    );
  }

  return (
    <div className="map-panel">
      <div ref={holder} className="map-canvas" role="img" aria-label="Map of the screened location" />
      <p className="map-caption">
        {hasShape
          ? "The outline is a county GIS parcel polygon. It is not a boundary survey and not a cadastral map."
          : "The point is from the street geocoder. It is not a parcel boundary."}
        {tilesFailed
          ? " OpenStreetMap tiles did not load, so there is no street basemap."
          : " The street basemap, if it appears, is OpenStreetMap."}
        {facts.dataOrigin === "snapshot" ? " This outline is from the October 25, 2026 snapshot, not a live query." : ""}
      </p>
      {tilesFailed && hasShape && rings ? <ParcelSchematic rings={rings} /> : null}
    </div>
  );
}

export function ParcelSchematic({ rings }: { rings: number[][][] }) {
  const points = rings.flat();
  const lons = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const width = Math.max(maxLon - minLon, 0.00001);
  const height = Math.max(maxLat - minLat, 0.00001);
  const path = rings
    .map((ring) =>
      ring
        .map(([lon, lat], index) => {
          const x = 12 + ((lon - minLon) / width) * 276;
          const y = 12 + ((maxLat - lat) / height) * 176;
          return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(" ") + " Z",
    )
    .join(" ");
  return (
    <figure className="schematic">
      <svg viewBox="0 0 300 200" role="img" aria-label="Schematic of the county GIS polygon">
        <rect width="300" height="200" fill="#f4f3f0" />
        <path d={path} fill="rgba(26,111,122,0.18)" stroke="#145860" strokeWidth="2" />
        <text x="16" y="24" fill="#145860" fontSize="12">
          N
        </text>
      </svg>
      <figcaption>
        Schematic of the county GIS polygon only. Not a survey, not a plat, and not a cadastral map.
      </figcaption>
    </figure>
  );
}
