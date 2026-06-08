"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { fromLonLat } from "ol/proj";
import Style from "ol/style/Style";
import Icon from "ol/style/Icon";
import Text from "ol/style/Text";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import XYZ from "ol/source/XYZ";
import BasemapSwitcher from "src/components/map/PointsMapBasemapSwitcher";

function parseCoordinates(point) {
  if (!point) return null;
  const geoloc = point.geoloc;
  let coords;

  if (geoloc) {
    if (typeof geoloc === "string") {
      const trimmed = geoloc.trim();
      if (trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          coords = parsed?.coordinates;
        } catch (error) {
          console.warn("Failed to parse geoloc JSON", error);
        }
      } else {
        const match = trimmed.match(/POINT\s*\(([-\d.]+)\s+([-\d.]+)\)/i);
        if (match) {
          coords = [parseFloat(match[1]), parseFloat(match[2])];
        }
      }
    } else if (Array.isArray(geoloc)) {
      coords = geoloc;
    } else if (
      typeof geoloc === "object" &&
      Array.isArray(geoloc.coordinates)
    ) {
      coords = geoloc.coordinates;
    }
  }

  let lon;
  let lat;

  if (Array.isArray(coords) && coords.length >= 2) {
    lon = Number(coords[0]);
    lat = Number(coords[1]);
  } else {
    lon = Number(
      point?.longitude ??
        point?.lon ??
        point?.location?.longitude ??
        point?.location?.lon ??
        (Array.isArray(coords) ? coords[0] : undefined)
    );
    lat = Number(
      point?.latitude ??
        point?.lat ??
        point?.location?.latitude ??
        point?.location?.lat ??
        (Array.isArray(coords) ? coords[1] : undefined)
    );
  }

  if (Number.isFinite(lon) && Number.isFinite(lat)) {
    return [lon, lat];
  }
  return null;
}

export default function PointDetailMap({ point, coords }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const vectorSourceRef = useRef(null);
  const vectorLayerRef = useRef(null);
  const baseLayerRef = useRef(null);
  const [baseMap, setBaseMap] = useState("CRV");

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    const pointerSvg = encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#90caf9;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1e88e5;stop-opacity:1" />
          </linearGradient>
        </defs>
        <path d="M16 2C10.21 2 5.5 6.71 5.5 12.5c0 7.64 9.62 17.92 9.62 17.92s9.38-9.98 9.38-17.92C24.5 6.71 19.79 2 16 2zm0 13.3a3.3 3.3 0 1 1 0-6.6 3.3 3.3 0 0 1 0 6.6z" fill="url(#grad)" stroke="#0d47a1" stroke-width="0.9" />
        <circle cx="16" cy="12" r="1.8" fill="#fff" />
      </svg>
    `);

    const createMarkerStyle = (pointName) =>
      new Style({
        image: new Icon({
          src: `data:image/svg+xml;charset=UTF-8,${pointerSvg}`,
          imgSize: [32, 32],
          anchor: [0.5, 1],
          anchorXUnits: "fraction",
          anchorYUnits: "fraction",
          scale: 1,
        }),
        text: pointName
          ? new Text({
              text: pointName,
              offsetY: -35,
              font: "14px Arial, sans-serif",
              fill: new Fill({
                color: "#000000ff",
              }),
              stroke: new Stroke({
                color: "#ffffff",
                width: 3,
              }),
              textAlign: "center",
              textBaseline: "bottom",
            })
          : undefined,
      });

    const createBaseLayer = (key) => {
      switch (key) {
        case "GMS":
          return new TileLayer({
            source: new XYZ({
              url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
            }),
          });
        case "ESRI":
          return new TileLayer({
            source: new XYZ({
              url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              maxZoom: 19,
            }),
          });
        case "TOPO":
          return new TileLayer({
            source: new XYZ({
              url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
              maxZoom: 17,
            }),
          });
        case "OSM":
          return new TileLayer({ source: new OSM() });
        case "CRV":
        default:
          return new TileLayer({
            source: new XYZ({
              url: "https://{a-c}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
            }),
          });
      }
    };

    const baseLayer = createBaseLayer(baseMap);
    baseLayerRef.current = baseLayer;

    const vectorSource = new VectorSource();
    vectorSourceRef.current = vectorSource;

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: (feature) => createMarkerStyle(feature.get("pointName")),
    });
    vectorLayerRef.current = vectorLayer;

    const map = new Map({
      target: containerRef.current,
      layers: [baseLayer, vectorLayer],
      view: new View({
        center: fromLonLat([106.9057, 47.9084]),
        zoom: 5,
      }),
    });

    mapRef.current = map;

    return () => {
      map.setTarget(null);
      mapRef.current = null;
      vectorSourceRef.current = null;
      vectorLayerRef.current = null;
      baseLayerRef.current = null;
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const basemapOptions = useMemo(
    () => [
      {
        key: "CRV",
        label: "Voyager",
        description: "Carto Voyager",
      },
      {
        key: "OSM",
        label: "OpenStreetMap",
        description: "Community map",
      },
      {
        key: "GMS",
        label: "Satellite",
        description: "Google imagery",
      },
      {
        key: "ESRI",
        label: "ESRI Img",
        description: "ESRI imagery",
      },
      {
        key: "TOPO",
        label: "Topographic",
        description: "Terrain details",
      },
    ],
    []
  );

  useEffect(() => {
    if (!mapRef.current || !baseLayerRef.current) return;

    const map = mapRef.current;
    const newBaseLayer = (() => {
      switch (baseMap) {
        case "GMS":
          return new TileLayer({
            source: new XYZ({
              url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
            }),
          });
        case "ESRI":
          return new TileLayer({
            source: new XYZ({
              url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              maxZoom: 19,
            }),
          });
        case "TOPO":
          return new TileLayer({
            source: new XYZ({
              url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
              maxZoom: 17,
            }),
          });
        case "OSM":
          return new TileLayer({ source: new OSM() });
        case "CRV":
        default:
          return new TileLayer({
            source: new XYZ({
              url: "https://{a-c}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
            }),
          });
      }
    })();

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
    }

    baseLayerRef.current = newBaseLayer;
    map.getLayers().insertAt(0, newBaseLayer);
  }, [baseMap]);

  useEffect(() => {
    if (!vectorSourceRef.current) {
      return;
    }

    const source = vectorSourceRef.current;
    source.clear();

    const coordinatePair = coords || parseCoordinates(point);
    if (coordinatePair && mapRef.current) {
      const feature = new Feature({
        geometry: new Point(fromLonLat([coordinatePair[0], coordinatePair[1]])),
        pointName: point?.name || "",
      });
      source.addFeature(feature);

      const view = mapRef.current.getView();
      const lonLat = fromLonLat([coordinatePair[0], coordinatePair[1]]);
      view.animate({
        center: lonLat,
        zoom: Math.max(view.getZoom(), 6),
        duration: 600,
      });
    } else {
      source.clear();
    }
  }, [point, coords]);

  return (
    <Box sx={{ position: "relative", width: "100%", height: 400 }}>
      <Box
        ref={containerRef}
        sx={{
          width: "100%",
          height: "100%",
          backgroundColor: "grey.100",
          "& .ol-viewport": {
            borderRadius: 1,
          },
        }}
      />

      <BasemapSwitcher
        baseMap={baseMap}
        setBaseMap={setBaseMap}
        options={basemapOptions}
      />
    </Box>
  );
}

PointDetailMap.propTypes = {
  point: PropTypes.object,
  coords: PropTypes.array,
};
