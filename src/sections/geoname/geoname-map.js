"use client";

import PropTypes from "prop-types";
import { useRef, useEffect } from "react";

import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import { Draw } from "ol/interaction";
import OSM from "ol/source/OSM";
import GeoJSON from "ol/format/GeoJSON";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { fromLonLat } from "ol/proj";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";

import { Box, Button, Stack, Typography } from "@mui/material";

// Геометр төрөл (GEOM_TYPES нэр) → OpenLayers draw type
const OL_TYPE = { Цэг: "Point", Шугам: "LineString", Талбай: "Polygon" };

const STYLE = new Style({
  fill: new Fill({ color: "rgba(34,197,94,0.2)" }),
  stroke: new Stroke({ color: "#16a34a", width: 2 }),
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: "#16a34a" }),
    stroke: new Stroke({ color: "#fff", width: 2 }),
  }),
});

export default function GeonameMap({ geomType, value, onChange }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const sourceRef = useRef(null);
  const drawRef = useRef(null);
  const fmtRef = useRef(new GeoJSON());
  // onChange‑ийн хамгийн сүүлийн хувилбарыг ашиглах (stale closure‑оос сэргийлнэ)
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Газрын зургийг нэг удаа эхлүүлнэ
  useEffect(() => {
    const source = new VectorSource();
    sourceRef.current = source;
    const map = new Map({
      target: elRef.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        new VectorLayer({ source, style: STYLE }),
      ],
      view: new View({ center: fromLonLat([106.9, 47.92]), zoom: 5 }),
    });
    mapRef.current = map;

    // Одоо байгаа геометрийг ачаална (засах)
    if (value) {
      try {
        const feature = fmtRef.current.readFeature(value, {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        });
        source.addFeature(feature);
        map.getView().fit(feature.getGeometry().getExtent(), {
          padding: [40, 40, 40, 40],
          maxZoom: 14,
        });
      } catch (e) {
        /* ignore */
      }
    }

    // Collapse/анимэйшний дараа зөв хэмжээ авна (хатгалт буруу буудгийг засна)
    const sizers = [
      setTimeout(() => map.updateSize(), 200),
      setTimeout(() => map.updateSize(), 500),
    ];
    const ro = new ResizeObserver(() => map.updateSize());
    if (elRef.current) ro.observe(elRef.current);

    return () => {
      sizers.forEach(clearTimeout);
      ro.disconnect();
      map.setTarget(undefined);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Геометр төрлөөр Draw interaction тохируулна
  useEffect(() => {
    const map = mapRef.current;
    const source = sourceRef.current;
    if (!map || !source) return undefined;
    if (drawRef.current) {
      map.removeInteraction(drawRef.current);
      drawRef.current = null;
    }
    const olType = OL_TYPE[geomType];
    if (!olType) return undefined;

    const draw = new Draw({ source, type: olType });
    draw.on("drawstart", () => source.clear()); // нэг геометр
    draw.on("drawend", (e) => {
      const gj = fmtRef.current.writeFeatureObject(e.feature, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });
      onChangeRef.current(gj.geometry);
    });
    map.addInteraction(draw);
    drawRef.current = draw;
    return () => {
      map.removeInteraction(draw);
      drawRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geomType]);

  const clear = () => {
    sourceRef.current?.clear();
    onChangeRef.current(null);
  };

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 0.5 }}
      >
        <Typography variant="caption" color="text.secondary">
          {geomType === "Цэг"
            ? "Газрын зураг дээр дарж цэг тэмдэглэнэ"
            : `Газрын зураг дээр ${geomType?.toLowerCase()} зурна`}
        </Typography>
        <Button size="small" color="inherit" onClick={clear}>
          Арилгах
        </Button>
      </Stack>
      <Box
        ref={elRef}
        sx={{
          height: 340,
          width: "100%",
          borderRadius: 1,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
        }}
      />
    </Box>
  );
}

GeonameMap.propTypes = {
  geomType: PropTypes.string,
  value: PropTypes.object,
  onChange: PropTypes.func,
};
