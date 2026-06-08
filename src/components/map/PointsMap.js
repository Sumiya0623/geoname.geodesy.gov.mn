import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Box, Paper, Typography, Chip, Button } from "@mui/material";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { fromLonLat } from "ol/proj";
import Style from "ol/style/Style";
import Text from "ol/style/Text";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import CircleStyle from "ol/style/Circle";
import Overlay from "ol/Overlay";
import ScaleBadge from "./ScaleBadge";
import BasemapSwitcher from "./PointsMapBasemapSwitcher";

const PointsMap = ({ points = [], onPointClick, selectedPointId }) => {
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const vectorSourceRef = useRef(new VectorSource());
  const vectorLayerRef = useRef(null);
  const popupRef = useRef(null);
  const popupOverlayRef = useRef(null);
  const [popupContent, setPopupContent] = useState(null);
  const [baseMap, setBaseMap] = useState("CRV");
  const [scaleDenom, setScaleDenom] = useState(0);

  const getPointColor = useCallback((pointData) => {
    if (pointData?.measurements?.[0]?.network?.name) {
      const networkColors = {
        "ГРАВИМЕТРИЙН СҮЛЖЭЭ": "#00e676",
        "ӨНДРИЙН СҮЛЖЭЭ": "#ff6b35",
        "GNSS-ИЙН СҮЛЖЭЭ": "#7c4dff",
        "ТРИАНГУЛЯЦИЙН  СҮЛЖЭЭ": "#00e5ff",
      };
      return (
        networkColors?.[pointData?.measurements?.[0]?.network?.name] ||
        "#ff3d00"
      );
    }
    return "#ff3d00";
  }, []);

  const getNetworkGradient = (pointData) => {
    if (pointData?.measurements?.[0]?.network?.name) {
      const gradients = {
        "ГРАВИМЕТРИЙН СҮЛЖЭЭ": ["#00e676", "#1de9b6"],
        "ӨНДРИЙН СҮЛЖЭЭ": ["#ff6b35", "#ff8a65"],
        "GNSS-ИЙН СҮЛЖЭЭ": ["#7c4dff", "#9c27b0"],
        "ТРИАНГУЛЯЦИЙН  СҮЛЖЭЭ": ["#00e5ff", "#00acc1"],
      };
      return (
        gradients[pointData?.measurements?.[0]?.network?.name] || [
          "#ff3d00",
          "#ff5722",
        ]
      );
    }
    return ["#ff3d00", "#ff5722"];
  };

  const createCoolPointStyle = useCallback((feature, isSelected) => {
    const pointData = feature.get("pointData");
    const baseColor = getPointColor(pointData);

    const styles = [];

    if (isSelected) {
      styles.push(
        new Style({
          image: new CircleStyle({
            radius: 20,
            fill: new Fill({
              color: `${baseColor}20`,
            }),
            stroke: new Stroke({
              color: `${baseColor}40`,
              width: 2,
            }),
          }),
        })
      );
    }

    styles.push(
      new Style({
        image: new CircleStyle({
          radius: isSelected ? 14 : 12,
          fill: new Fill({
            color: isSelected ? `${baseColor}60` : `${baseColor}30`,
          }),
          stroke: new Stroke({
            color: "#ffffff",
            width: isSelected ? 3 : 2,
          }),
        }),
      })
    );

    styles.push(
      new Style({
        image: new CircleStyle({
          radius: isSelected ? 10 : 8,
          fill: new Fill({
            color: baseColor,
          }),
          stroke: new Stroke({
            color: "#ffffff",
            width: 2,
          }),
        }),
        text: new Text({
          text: feature.get("number"),
          font: isSelected
            ? 'bold 12px "Segoe UI", Arial'
            : 'bold 10px "Segoe UI", Arial',
          fill: new Fill({
            color: "#ffffff",
          }),
          stroke: new Stroke({
            color: "rgba(0, 0, 0, 0.9)",
            width: 3,
          }),
          offsetY: isSelected ? -25 : -20,
          backgroundFill: new Fill({
            color: "rgba(0, 0, 0, 0.8)",
          }),
          backgroundStroke: new Stroke({
            color: baseColor,
            width: 1,
          }),
          padding: [3, 6, 3, 6],
        }),
      })
    );

    styles.push(
      new Style({
        image: new CircleStyle({
          radius: isSelected ? 4 : 3,
          fill: new Fill({
            color: "#ffffff",
          }),
          stroke: new Stroke({
            color: baseColor,
            width: 1,
          }),
        }),
      })
    );

    return styles;
  }, [getPointColor]);

  const baseMapSources = useMemo(() => ({
    CRV: new XYZ({
      url: "https://{a-c}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    }),
    OSM: new OSM(),
    GMS: new XYZ({
      url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    }),
    ESRI: new XYZ({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attributions: "Tiles © Esri",
      maxZoom: 19,
    }),
    TOPO: new XYZ({
      url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
      attributions:
        'Map style: © <a href="https://opentopomap.org">OpenTopoMap</a>',
      maxZoom: 17,
    }),
  }), []);

  const updateScaleFromView = (view) => {
    try {
      const resolution = view.getResolution();
      if (resolution == null) return;
      const projection = view.getProjection();
      const mpu = projection?.getMetersPerUnit?.() || 1;
      const dpi = 96; // screen DPI assumption
      const inchesPerMeter = 39.37;
      const scale = resolution * mpu * inchesPerMeter * dpi;
      setScaleDenom(Math.max(1, Math.round(scale)));
    } catch (_) {}
  };

  useEffect(() => {
    if (!mapRef.current) return;

    const vectorLayer = new VectorLayer({
      source: vectorSourceRef.current,
      style: (feature) => {
        const isSelected = feature.get("id") === selectedPointId;
        return createCoolPointStyle(feature, isSelected);
      },
    });

    vectorLayerRef.current = vectorLayer;

    const popupOverlay = new Overlay({
      element: popupRef.current,
      autoPan: false,
      //   autoPan: true,
      //   autoPanAnimation: {
      //     duration: 250,
      //   },
    });
    popupOverlayRef.current = popupOverlay;

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: baseMapSources[baseMap],
        }),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat([106.9057, 47.9084]),
        zoom: 6,
      }),
      overlays: [popupOverlay],
    });

    mapObjRef.current = map;

    const view = map.getView();
    const onResChange = () => updateScaleFromView(view);
    updateScaleFromView(view);
    view.on("change:resolution", onResChange);

    map.on("click", (event) => {
      const feature = map.forEachFeatureAtPixel(
        event.pixel,
        (feature) => feature
      );
      if (feature) {
        const pointData = feature.get("pointData");
        const coordinate = event.coordinate;

        // Center the map on the clicked point
        // map.getView().animate({
        //   center: coordinate,
        //   duration: 500,
        // //   zoom: Math.max(map.getView().getZoom(), 12) // Ensure minimum zoom level
        // });

        setPopupContent(pointData);

        popupOverlay.setPosition(coordinate);
      } else {
        popupOverlay.setPosition(undefined);
        setPopupContent(null);
      }
    });

    map.on("pointermove", (event) => {
      const hit = map.hasFeatureAtPixel(event.pixel);
      map.getTarget().style.cursor = hit ? "pointer" : "";
    });

    return () => {
      try {
        view.un("change:resolution", onResChange);
      } catch (_) {}
      map.setTarget(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapObjRef.current) return;
    const map = mapObjRef.current;
    const baseLayer = map.getLayers().item(0);
    if (baseLayer) {
      baseLayer.setSource(baseMapSources[baseMap]);
    }
  }, [baseMap, baseMapSources]);

  useEffect(() => {
    if (!vectorSourceRef.current) return;

    vectorSourceRef.current.clear();

    const features = [];
    points.forEach((point) => {
      if (point.geoloc) {
        try {
          let coordinates;
          if (typeof point.geoloc === "string") {
            const geom = JSON.parse(point.geoloc);
            coordinates = geom.coordinates;
          } else {
            coordinates = point.geoloc.coordinates;
          }

          if (coordinates && coordinates.length >= 2) {
            const feature = new Feature({
              geometry: new Point(fromLonLat([coordinates[0], coordinates[1]])),
              id: point.id,
              number: point.number,
              pointData: point,
            });

            features.push(feature);
          }
        } catch (error) {
          console.warn("Error parsing point coordinates:", error, point);
        }
      }
    });

    vectorSourceRef.current.addFeatures(features);

    if (
      features.length > 0 &&
      mapObjRef.current &&
      !mapObjRef.current.hasInitialFit
    ) {
      const extent = vectorSourceRef.current.getExtent();
      mapObjRef.current.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        maxZoom: 15,
      });
      mapObjRef.current.hasInitialFit = true;
    }
  }, [points]);

  useEffect(() => {
    if (vectorLayerRef.current) {
      vectorLayerRef.current.getSource().changed();
    }
  }, [selectedPointId]);

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
      <Box
        ref={mapRef}
        sx={{
          width: "100%",
          height: "100%",
          minHeight: "400px",
          border: "1px solid #e0e0e0",
          borderRadius: 1,
          position: "relative",
          "& .ol-viewport": {
            borderRadius: 1,
          },
          "& .ol-zoom": {
            top: "10px",
            left: "10px",
          },
          "& .ol-zoom button": {
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: "bold",
            "&:hover": {
              backgroundColor: "#f5f5f5",
            },
          },
          "& .ol-attribution": {
            bottom: "10px",
            right: "10px",
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            borderRadius: "4px",
            padding: "2px 4px",
            fontSize: "10px",
          },
        }}
      />

      <BasemapSwitcher
        baseMap={baseMap}
        setBaseMap={setBaseMap}
        options={baseMapSources}
      />

      <ScaleBadge scaleDenom={scaleDenom} />

      <div
        ref={popupRef}
        style={{
          display: popupContent ? "block" : "none",
          position: "absolute",
          zIndex: 1000,
        }}
      >
        {popupContent && (
          <Paper
            elevation={8}
            sx={{
              p: 2,
              minWidth: 250,
              maxWidth: 350,
              backgroundColor: "white",
              border: "1px solid #e0e0e0",
              borderRadius: 2,
              transform: "translate(-50%, -100%)",
              marginTop: "-10px",
              "&::after": {
                content: '""',
                position: "absolute",
                top: "100%",
                left: "50%",
                marginLeft: "-5px",
                borderWidth: "5px",
                borderStyle: "solid",
                borderColor: "white transparent transparent transparent",
              },
            }}
          >
            <Typography
              variant="h6"
              sx={{ fontWeight: 600, mb: 1, color: "#1976d2" }}
            >
              {popupContent.number}
            </Typography>

            {popupContent.name && (
              <Typography variant="body1" sx={{ mb: 1 }}>
                {popupContent.name}
              </Typography>
            )}

            <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
              {popupContent.network_type && (
                <Chip
                  size="small"
                  label={popupContent.network_type}
                  color="primary"
                  variant="outlined"
                />
              )}
              {popupContent?.status && (
                <Chip
                  size="small"
                  label={popupContent?.status?.name || ""}
                  sx={{
                    backgroundColor: popupContent?.status_color
                      ? `${popupContent?.status_color}20`
                      : "#e8f5e8",
                    color: popupContent?.status_color || "#4caf50",
                  }}
                />
              )}
            </Box>

            {/* {popupContent.measurements?.[0] && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Координатууд:
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                  X: {popupContent.measurements[0].final_x || 'Тодорхойгүй'}<br/>
                  Y: {popupContent.measurements[0].final_y || 'Тодорхойгүй'}<br/>
                  Z: {popupContent.measurements[0].final_z || 'Тодорхойгүй'}
                </Typography>
              </Box>
            )} */}

            <Button
              size="small"
              variant="contained"
              fullWidth
              onClick={() => {
                if (onPointClick) {
                  onPointClick(popupContent);
                }
                popupOverlayRef.current?.setPosition(undefined);
                setPopupContent(null);
              }}
              sx={{ textTransform: "none" }}
            >
              Цэг сонгох
            </Button>
          </Paper>
        )}
      </div>
    </Box>
  );
};

export default PointsMap;
