import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import {
  Layers,
  Sliders,
  Info,
  Droplets,
  CloudRain,
  Compass,
  AlertTriangle,
  ArrowRight,
  MapPin,
  Eye,
  CheckCircle2,
  WifiOff,
  Crosshair,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HazardZone, VulnerableSettlement, CandidateRelocationSite } from '../types/gis.types';
import { ValidatedFloodRiskRecord } from '../types/csvDataset.types';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { VerificationBadge } from '../components/common/VerificationBadge';
import {
  generateBufferedPolygon,
  checkSettlementHazardIntersection,
  calculateHaversineDistanceMeters,
} from '../utils/gisCalculators';

type BaseMapType = 'dark' | 'light' | 'osm' | 'satellite';

export const HazardMapView: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const {
    hazardZones,
    settlements,
    candidateSites,
    isVerifiedOnly,
    csvRawRecords,
    csvRecordCount,
    setCurrentRoute,
    hazardBufferMeters,
    setHazardBufferMeters,
    selectedDistrict,
    theme,
  } = useApp();

  // Reactive state to trigger layer rendering only when map instance is ready
  const [mapReady, setMapReady] = useState(false);
  const [tileLoading, setTileLoading] = useState(true);
  const [tileError, setTileError] = useState(false);

  // Map Filter & Layer Toggles
  const [showLandslides, setShowLandslides] = useState(true);
  const [showFloods, setShowFloods] = useState(true);
  const [showSettlements, setShowSettlements] = useState(true);
  const [showCandidateSites, setShowCandidateSites] = useState(true);
  const [showCsvPoints, setShowCsvPoints] = useState(!isVerifiedOnly);
  const [showBufferZones, setShowBufferZones] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [baseMap, setBaseMap] = useState<BaseMapType>(theme === 'light' ? 'light' : 'dark');
  const [filterTrappedOnly, setFilterTrappedOnly] = useState(false);

  // Selected feature inspector state
  const [selectedSettlement, setSelectedSettlement] = useState<VulnerableSettlement | null>(null);
  const [selectedHazard, setSelectedHazard] = useState<HazardZone | null>(null);
  const [selectedSite, setSelectedSite] = useState<CandidateRelocationSite | null>(null);
  const [selectedCsvRecord, setSelectedCsvRecord] = useState<ValidatedFloodRiskRecord | null>(null);

  // Sync showCsvPoints with isVerifiedOnly
  useEffect(() => {
    setShowCsvPoints(!isVerifiedOnly);
  }, [isVerifiedOnly]);

  // Synchronize base map with global theme if user hasn't explicitly chosen satellite
  useEffect(() => {
    if (baseMap !== 'satellite') {
      setBaseMap(theme === 'light' ? 'light' : 'dark');
    }
  }, [theme]);

  // Real-time calculation of settlements trapped inside active Red Zones + Buffer
  const trappedAnalysis = useMemo(() => {
    const activeHazards = hazardZones.filter(hz => {
      if (hz.hazardType === 'landslide' && !showLandslides) return false;
      if (hz.hazardType === 'riverine_flood' && !showFloods) return false;
      return true;
    });

    const trappedMap = new Map<string, { distanceM: number; hazardType: string }>();

    settlements.forEach(s => {
      const check = checkSettlementHazardIntersection(s, activeHazards, hazardBufferMeters);
      if (check.isTrappedInRedZone) {
        trappedMap.set(s.id, {
          distanceM: check.distanceToPerimeterM,
          hazardType: check.intersectingHazardType || s.primaryHazardExposure,
        });
      }
    });

    const trappedList = settlements.filter(s => trappedMap.has(s.id));
    const totalTrappedPop = trappedList.reduce((acc, s) => acc + s.totalPopulation, 0);

    return {
      trappedMap,
      trappedList,
      totalTrappedPop,
    };
  }, [settlements, hazardZones, showLandslides, showFloods, hazardBufferMeters]);

  // Tile layer URL helper
  const getTileConfig = (type: BaseMapType) => {
    switch (type) {
      case 'satellite':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: '&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
          maxZoom: 19,
          subdomains: '',
        };
      case 'osm':
        return {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          subdomains: 'abc',
        };
      case 'light':
        return {
          url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
          subdomains: 'abcd',
        };
      case 'dark':
      default:
        return {
          url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
          subdomains: 'abcd',
        };
    }
  };

  // Initialize Map Instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center over India (Western Ghats - Central India perspective)
    const map = L.map(mapContainerRef.current, {
      center: [20.5, 78.9],
      zoom: 5,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    const tileCfg = getTileConfig(baseMap);
    const tileLayer = L.tileLayer(tileCfg.url, {
      attribution: tileCfg.attribution,
      maxZoom: tileCfg.maxZoom,
      subdomains: tileCfg.subdomains || 'abcd',
    });

    tileLayer.on('loading', () => setTileLoading(true));
    tileLayer.on('load', () => {
      setTileLoading(false);
      setTileError(false);
    });
    tileLayer.on('tileerror', () => {
      setTileLoading(false);
      setTileError(true);
    });

    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;
    setMapReady(true);

    // Call invalidateSize after DOM settles
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);

    // Resize observer to handle window / layout resize smoothly
    let resizeObserver: ResizeObserver | null = null;
    if (window.ResizeObserver && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(timer);
      if (resizeObserver) resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Handle Base Map Switching
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileCfg = getTileConfig(baseMap);
    const newTileLayer = L.tileLayer(tileCfg.url, {
      attribution: tileCfg.attribution,
      maxZoom: tileCfg.maxZoom,
      subdomains: tileCfg.subdomains || 'abcd',
    });

    newTileLayer.on('loading', () => setTileLoading(true));
    newTileLayer.on('load', () => {
      setTileLoading(false);
      setTileError(false);
    });
    newTileLayer.on('tileerror', () => {
      setTileLoading(false);
      setTileError(true);
    });

    newTileLayer.addTo(map);
    tileLayerRef.current = newTileLayer;
  }, [baseMap]);

  // Fit view to visible active records
  const fitToDataBounds = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const latLngs: [number, number][] = [];

    settlements.forEach(s => {
      latLngs.push([s.coordinates.lat, s.coordinates.lng]);
    });

    hazardZones.forEach(hz => {
      hz.coordinates.forEach(c => latLngs.push([c.lat, c.lng]));
    });

    candidateSites.forEach(cs => {
      latLngs.push([cs.centroid.lat, cs.centroid.lng]);
    });

    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 13,
        animate: true,
        duration: 1.0,
      });
    }
  }, [settlements, hazardZones, candidateSites]);

  // Auto-fit bounds when district filter changes
  useEffect(() => {
    if (mapReady && selectedDistrict !== 'all') {
      fitToDataBounds();
    }
  }, [selectedDistrict, mapReady, fitToDataBounds]);

  // Jump to specific geographic hot-spots
  const flyToRegion = (lat: number, lng: number, zoom: number) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], zoom, { duration: 1.2 });
    }
  };

  // Render Geospatial Vector Layers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !layerGroupRef.current) return;

    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    // 1. Hazard Core Polygons & Dynamic Buffers
    hazardZones.forEach(hz => {
      if (hz.hazardType === 'landslide' && !showLandslides) return;
      if (hz.hazardType === 'riverine_flood' && !showFloods) return;

      const latLngs = hz.coordinates.map(c => [c.lat, c.lng] as [number, number]);
      if (latLngs.length < 3) return;

      const color =
        hz.hazardType === 'landslide'
          ? '#ef4444'
          : hz.hazardType === 'riverine_flood'
            ? '#3b82f6'
            : hz.hazardType === 'cloudburst_flash_flood'
              ? '#a855f7'
              : '#f97316';

      // 1A. Render Dynamic PostGIS Buffer Ring (if toggled)
      if (showBufferZones && hazardBufferMeters > 0) {
        const bufferedCoords = generateBufferedPolygon(hz.coordinates, hazardBufferMeters);
        const bufferLatLngs = bufferedCoords.map(c => [c.lat, c.lng] as [number, number]);

        const bufferPoly = L.polygon(bufferLatLngs, {
          color: color,
          fillColor: color,
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: '5, 5',
        });

        bufferPoly.bindTooltip(
          `<strong>${hz.hazardType.toUpperCase()} BUFFER ZONE (+${hazardBufferMeters}m)</strong><br/>PostGIS Exclusion Perimeter`,
          { className: 'gis-tooltip' }
        );

        layerGroup.addLayer(bufferPoly);
      }

      // 1B. Core Hazard Red Zone Polygon
      const polygon = L.polygon(latLngs, {
        color: color,
        fillColor: color,
        fillOpacity: 0.45,
        weight: 2.5,
        dashArray: hz.isVerified ? undefined : '6, 6',
      });

      polygon.on('click', () => {
        setSelectedHazard(hz);
        setSelectedSettlement(null);
        setSelectedSite(null);
        setSelectedCsvRecord(null);
      });

      polygon.bindPopup(`
        <div class="p-2 space-y-1.5 font-sans min-w-[200px]">
          <div class="flex items-center justify-between border-b border-gis-border pb-1">
            <strong class="text-sm font-bold uppercase text-red-500">${hz.hazardType.replace(/_/g, ' ')}</strong>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800 font-bold">${hz.severity.toUpperCase()}</span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-300">${hz.description}</p>
          <div class="grid grid-cols-2 gap-1 text-[11px] font-mono pt-1 text-slate-700 dark:text-slate-300">
            <div>Surface Area: <strong>${hz.areaSqKm} km²</strong></div>
            <div>Buffer: <strong>+${hazardBufferMeters}m</strong></div>
          </div>
          <div class="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-gis-border/60">
            Source: <em>${hz.dataSource}</em>
          </div>
        </div>
      `, { maxWidth: 300 });

      polygon.bindTooltip(
        `<strong>${hz.hazardType.toUpperCase()} RED ZONE</strong><br/>Severity: ${hz.severity}<br/>Source: ${hz.dataSource}`,
        { className: 'gis-tooltip' }
      );

      layerGroup.addLayer(polygon);
    });

    // 2. Candidate Relocation Sites (Green Polygons)
    if (showCandidateSites) {
      candidateSites.forEach(site => {
        const latLngs = site.coordinates.map(c => [c.lat, c.lng] as [number, number]);
        if (latLngs.length < 3) return;

        const polygon = L.polygon(latLngs, {
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.28,
          weight: 2,
          dashArray: site.isVerified ? undefined : '4, 4',
        });

        polygon.on('click', () => {
          setSelectedSite(site);
          setSelectedSettlement(null);
          setSelectedHazard(null);
          setSelectedCsvRecord(null);
        });

        polygon.bindPopup(`
          <div class="p-2 space-y-1.5 font-sans min-w-[220px]">
            <div class="flex items-center justify-between border-b border-gis-border pb-1">
              <strong class="text-sm font-bold text-emerald-600 dark:text-emerald-400">${site.locationName}</strong>
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800 font-bold">SUITABILITY ${site.suitabilityScore}</span>
            </div>
            <p class="text-[11px] text-slate-600 dark:text-slate-400 font-mono">${site.siteCode} • District: ${site.district}</p>
            <div class="grid grid-cols-2 gap-1.5 text-xs font-mono pt-1 text-slate-700 dark:text-slate-200">
              <div class="p-1 rounded bg-gis-surface border border-gis-border">
                <span class="text-[10px] text-slate-500 dark:text-slate-400 block">CAPACITY</span>
                <strong class="text-emerald-600 dark:text-emerald-400">${site.maxCarryingCapacityPop.toLocaleString()} pop</strong>
              </div>
              <div class="p-1 rounded bg-gis-surface border border-gis-border">
                <span class="text-[10px] text-slate-500 dark:text-slate-400 block">AVG SLOPE</span>
                <strong>${site.avgSlopeDegrees}° (${site.avgSlopeDegrees <= 15 ? 'Cleared' : 'Restricted'})</strong>
              </div>
            </div>
            <div class="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-gis-border/60">
              Usable: ${(site.usableAreaSqm / 1000).toFixed(0)}k m² | Road: ${site.distanceToPrimaryRoadM}m
            </div>
          </div>
        `, { maxWidth: 320 });

        polygon.bindTooltip(
          `<strong>SAFE RELOCATION SITE: ${site.locationName}</strong><br/>Max Capacity: ${site.maxCarryingCapacityPop.toLocaleString()} pop<br/>Usable Area: ${(site.usableAreaSqm / 1000).toFixed(0)}k m²`,
          { className: 'gis-tooltip' }
        );

        layerGroup.addLayer(polygon);
      });
    }

    // 3. Vulnerable Settlements (High-Impact Markers with Red-Zone Visual Feedback)
    if (showSettlements) {
      const displaySettlements = filterTrappedOnly
        ? settlements.filter(s => trappedAnalysis.trappedMap.has(s.id))
        : settlements;

      displaySettlements.forEach(s => {
        const trapped = trappedAnalysis.trappedMap.get(s.id);
        const isTrapped = Boolean(trapped);
        const isCritical = s.calculatedRiskScore >= 90 || isTrapped;

        const markerColor = isTrapped
          ? '#ef4444'
          : s.calculatedRiskScore >= 90
            ? '#f43f5e'
            : s.calculatedRiskScore >= 75
              ? '#f59e0b'
              : '#3b82f6';

        const customIcon = L.divIcon({
          className: 'custom-settlement-marker',
          html: `
            <div style="
              position: relative;
              width: ${isTrapped ? '28px' : isCritical ? '24px' : '18px'};
              height: ${isTrapped ? '28px' : isCritical ? '24px' : '18px'};
              background: ${markerColor};
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 0 ${isTrapped ? '16px #ef4444' : '10px ' + markerColor};
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: ${isTrapped ? '12px' : '10px'};
              font-weight: 800;
              cursor: pointer;
            ">
              ${isTrapped ? '⚠️' : isCritical ? '!' : ''}
              ${isTrapped
              ? '<div style="position: absolute; inset: -6px; border: 2px dashed #f87171; border-radius: 50%; animation: spin 4s linear infinite;"></div>'
              : ''
            }
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([s.coordinates.lat, s.coordinates.lng], { icon: customIcon });

        marker.on('click', () => {
          setSelectedSettlement(s);
          setSelectedHazard(null);
          setSelectedSite(null);
          setSelectedCsvRecord(null);
        });

        marker.bindPopup(`
          <div class="p-2 space-y-1.5 font-sans min-w-[220px]">
            <div class="flex items-center justify-between border-b border-gis-border pb-1">
              <strong class="text-sm font-bold text-slate-900 dark:text-white">${s.name}</strong>
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                s.priorityHorizon === 'immediate'
                  ? 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800'
                  : s.priorityHorizon === 'short_term'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800'
                  : 'bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800'
              }">${s.priorityHorizon.toUpperCase()}</span>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-300 font-mono">${s.district} • AHP Risk: <strong class="text-red-500">${s.calculatedRiskScore}/100</strong></p>
            <div class="grid grid-cols-2 gap-1 text-[11px] font-mono pt-1 text-slate-700 dark:text-slate-200">
              <div>Pop: <strong>${s.totalPopulation.toLocaleString()}</strong></div>
              <div>Families: <strong>${s.householdCount}</strong></div>
              <div>Kuccha: <strong>${s.kucchaHousesPct}%</strong></div>
              <div>Events: <strong>${s.historicalEventCount} recorded</strong></div>
            </div>
            ${
              isTrapped
                ? `<div class="p-1 rounded bg-red-100 text-red-800 border border-red-300 dark:bg-red-950/70 dark:border-red-800 dark:text-red-200 text-[10px] font-bold mt-1">
                    ⚠️ TRAPPED IN HAZARD RED ZONE BUFFER (+${trapped?.distanceM}m)
                  </div>`
            : ''
          }
            <div class="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-gis-border/60">
              Click marker to inspect full dossier and match candidate sites.
            </div>
          </div>
        `, { maxWidth: 320 });

        marker.bindTooltip(
          `<strong>${s.name}</strong><br/>` +
          `AHP Risk Score: <strong>${s.calculatedRiskScore}</strong> (${s.priorityHorizon.toUpperCase()})<br/>` +
          `Population: ${s.totalPopulation.toLocaleString()}<br/>` +
          (isTrapped
            ? `<span style="color: #ef4444; font-weight: bold;">⚠️ INSIDE RED ZONE BUFFER (+${trapped?.distanceM}m)</span>`
            : `<span style="color: #10b981;">Outside active buffer</span>`),
          { className: 'gis-tooltip' }
        );

        layerGroup.addLayer(marker);
      });
    }

    // 4. CSV Flood Risk Observations (Canvas Circle Markers)
    if (showCsvPoints && !isVerifiedOnly && csvRawRecords.length > 0) {
      const canvasRenderer = L.canvas({ padding: 0.5 });
      const samplePoints = csvRawRecords.slice(0, 1500);

      samplePoints.forEach(r => {
        const isFlood = r.floodOccurred;
        const circle = L.circleMarker([r.latitude, r.longitude], {
          renderer: canvasRenderer,
          radius: isFlood ? 5 : 3.5,
          color: isFlood ? '#ef4444' : '#0ea5e9',
          fillColor: isFlood ? '#f87171' : '#38bdf8',
          fillOpacity: isFlood ? 0.8 : 0.45,
          weight: 1,
        });

        circle.bindPopup(`
          <div class="p-2 space-y-1.5 font-sans min-w-[200px]">
            <div class="flex items-center justify-between border-b border-gis-border pb-1">
              <strong class="text-xs font-bold text-cyan-600 dark:text-cyan-300">CSV Flood Station #${r.rowIndex}</strong>
              <span class="text-[9px] font-mono px-1 py-0.2 rounded font-bold ${
                r.floodOccurred
                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
              }">${r.floodOccurred ? 'FLOOD (1)' : 'NO FLOOD (0)'}</span>
            </div>
            <p class="text-[10px] text-slate-600 dark:text-slate-400 font-mono">${r.geographicZone}</p>
            <div class="grid grid-cols-2 gap-1 text-[11px] font-mono text-slate-700 dark:text-slate-200">
              <div>Rainfall: <strong>${r.rainfallMm} mm</strong></div>
              <div>Water Level: <strong>${r.waterLevelM} m</strong></div>
              <div>Discharge: <strong>${r.riverDischargeM3s.toFixed(0)} m³/s</strong></div>
              <div>Elevation: <strong>${r.elevationM.toFixed(0)} m</strong></div>
            </div>
            <div class="text-[9px] text-amber-700 dark:text-amber-300 pt-1 border-t border-gis-border/60">
              Source: docs/flood_risk_dataset_india.csv (Benchmark/Demo)
            </div>
          </div>
        `, { maxWidth: 280 });

        circle.bindTooltip(
          `<strong>[DEMO] Flood Station #${r.rowIndex}</strong><br/>` +
          `Flood Occurred: <strong>${r.floodOccurred ? 'YES' : 'NO'}</strong><br/>` +
          `Rainfall: ${r.rainfallMm} mm | Water Level: ${r.waterLevelM} m<br/>` +
          `<em>docs/flood_risk_dataset_india.csv</em>`,
          { className: 'gis-tooltip' }
        );

        circle.on('click', () => {
          setSelectedCsvRecord(r);
          setSelectedSettlement(null);
          setSelectedHazard(null);
          setSelectedSite(null);
        });

        layerGroup.addLayer(circle);
      });
    }
  }, [
    mapReady,
    hazardZones,
    settlements,
    candidateSites,
    showLandslides,
    showFloods,
    showSettlements,
    showCandidateSites,
    showCsvPoints,
    showBufferZones,
    isVerifiedOnly,
    csvRawRecords,
    hazardBufferMeters,
    filterTrappedOnly,
    trappedAnalysis,
  ]);

  // Nearest Candidate Site calculation for selected settlement
  const nearestCandidateSite = useMemo(() => {
    if (!selectedSettlement || candidateSites.length === 0) return null;

    let nearest: { site: CandidateRelocationSite; distanceKm: number } | null = null;
    for (const site of candidateSites) {
      const distM = calculateHaversineDistanceMeters(
        selectedSettlement.coordinates,
        site.centroid
      );
      const distKm = Number((distM / 1000).toFixed(1));
      if (!nearest || distKm < nearest.distanceKm) {
        nearest = { site, distanceKm: distKm };
      }
    }
    return nearest;
  }, [selectedSettlement, candidateSites]);

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden flex flex-col bg-gis-darkest">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="h-full w-full z-0 bg-gis-darkest" />

      {/* Tile Loading / Network Warning HUD */}
      {tileLoading && !tileError && (
        <div className="absolute top-4 right-14 z-20 bg-gis-surface/85 backdrop-blur-md text-gis-textSecondary border border-gis-border rounded-xl px-3 py-1.5 text-xs shadow-xl flex items-center gap-2 font-mono">
          <span className="w-2 h-2 rounded-full bg-gis-accent animate-ping" />
          <span>Fetching Base Map Tiles...</span>
        </div>
      )}

      {tileError && (
        <div className="absolute top-4 right-14 z-20 bg-amber-950/90 text-amber-200 border border-amber-700/80 rounded-xl px-3 py-1.5 text-xs shadow-xl flex items-center gap-2 max-w-sm">
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Online base map tiles unreachable (offline). Spatial vector polygons and settlements are fully operational.</span>
        </div>
      )}

      {/* Trapped Settlements Banner HUD */}
      {trappedAnalysis.trappedList.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 max-w-xl w-[90%] sm:w-auto bg-red-950/90 backdrop-blur-md border border-red-700/80 rounded-xl px-4 py-2.5 shadow-2xl flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <div>
              <p className="font-bold text-white tracking-wide">
                RED ZONE HAZARD BUFFER ALERT (+{hazardBufferMeters}m)
              </p>
              <p className="text-red-200 text-[11px]">
                {trappedAnalysis.trappedList.length} settlements (
                {trappedAnalysis.totalTrappedPop.toLocaleString()} citizens) inside active impact
                envelope.
              </p>
            </div>
          </div>

          <button
            onClick={() => setFilterTrappedOnly(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all shrink-0 ${filterTrappedOnly
                ? 'bg-red-600 text-white shadow'
                : 'bg-red-900/60 text-red-200 hover:bg-red-800'
              }`}
          >
            {filterTrappedOnly ? 'Show All' : 'Filter Trapped'}
          </button>
        </div>
      )}

      {/* Floating Spatial Controls Panel */}
      <div className="absolute top-4 left-4 z-10 w-72 sm:w-80 bg-gis-dark/95 backdrop-blur-md border border-gis-border rounded-xl p-3.5 shadow-2xl space-y-3 transition-colors duration-200">
        <div className="flex items-center justify-between border-b border-gis-border pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gis-accent" />
            <span className="text-xs font-bold text-gis-textPrimary uppercase tracking-wider">
              GIS Vector Controls
            </span>
          </div>
          <VerificationBadge
            isVerified={isVerifiedOnly}
            dataSource={isVerifiedOnly ? 'Verified GSI/CWC' : 'All + Demo'}
            size="sm"
          />
        </div>

        {/* Base Map Switcher */}
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-mono text-slate-400 block">Base Map</span>
          <div className="grid grid-cols-4 gap-1 text-[11px]">
            {(['dark', 'light', 'osm', 'satellite'] as const).map(type => (
              <button
                key={type}
                onClick={() => setBaseMap(type)}
                className={`py-1 rounded font-medium transition-all ${baseMap === type
                    ? 'bg-gis-accent text-white shadow-sm font-bold'
                    : 'bg-gis-surface text-slate-400 hover:text-gis-textPrimary'
                  }`}
              >
                {type === 'dark' ? 'Dark' : type === 'light' ? 'Light' : type === 'osm' ? 'OSM' : 'Sat'}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions: Fit Bounds & Hot-Spots */}
        <div className="space-y-1.5 pt-1 border-t border-gis-border/60">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono text-slate-400 flex items-center gap-1">
              <Compass className="w-3 h-3 text-gis-accent" /> Quick Viewports
            </span>
            <button
              onClick={fitToDataBounds}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono font-medium"
              title="Fit map viewport to all visible records"
            >
              <Crosshair className="w-3 h-3" /> Fit Data Bounds
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <button
              onClick={() => flyToRegion(11.54, 76.16, 12)}
              className="px-2 py-1 rounded bg-gis-surface hover:bg-gis-border text-gis-textPrimary text-left font-mono truncate"
            >
              ⛰️ Wayanad (Landslide)
            </button>
            <button
              onClick={() => flyToRegion(30.54, 79.58, 12)}
              className="px-2 py-1 rounded bg-gis-surface hover:bg-gis-border text-gis-textPrimary text-left font-mono truncate"
            >
              🏔️ Chamoli (Cloudburst)
            </button>
            <button
              onClick={() => flyToRegion(26.19, 91.78, 11)}
              className="px-2 py-1 rounded bg-gis-surface hover:bg-gis-border text-gis-textPrimary text-left font-mono truncate"
            >
              🌊 Majuli (Floodplain)
            </button>
            <button
              onClick={() => flyToRegion(21.5, 80.0, 5)}
              className="px-2 py-1 rounded bg-gis-surface hover:bg-gis-border text-gis-textPrimary text-left font-mono truncate"
            >
              🇮🇳 All-India Overview
            </button>
          </div>
        </div>

        {/* Layer Toggles */}
        <div className="space-y-1.5 text-xs pt-1 border-t border-gis-border/60">
          <label className="flex items-center justify-between p-1 rounded hover:bg-gis-surface cursor-pointer">
            <span className="flex items-center gap-2 text-gis-textPrimary">
              <span className="w-3 h-3 rounded bg-red-500 shrink-0" />
              Landslide Slip Zones
            </span>
            <input
              type="checkbox"
              checked={showLandslides}
              onChange={e => setShowLandslides(e.target.checked)}
              className="rounded bg-gis-dark border-gis-border text-gis-accent focus:ring-0"
            />
          </label>

          <label className="flex items-center justify-between p-1 rounded hover:bg-gis-surface cursor-pointer">
            <span className="flex items-center gap-2 text-gis-textPrimary">
              <span className="w-3 h-3 rounded bg-blue-500 shrink-0" />
              Flood Inundation Plains
            </span>
            <input
              type="checkbox"
              checked={showFloods}
              onChange={e => setShowFloods(e.target.checked)}
              className="rounded bg-gis-dark border-gis-border text-gis-accent focus:ring-0"
            />
          </label>

          <label className="flex items-center justify-between p-1 rounded hover:bg-gis-surface cursor-pointer">
            <span className="flex items-center gap-2 text-gis-textPrimary">
              <span className="w-3 h-3 rounded-full bg-red-400 border border-white shrink-0" />
              Vulnerable Settlements
            </span>
            <input
              type="checkbox"
              checked={showSettlements}
              onChange={e => setShowSettlements(e.target.checked)}
              className="rounded bg-gis-dark border-gis-border text-gis-accent focus:ring-0"
            />
          </label>

          <label className="flex items-center justify-between p-1 rounded hover:bg-gis-surface cursor-pointer">
            <span className="flex items-center gap-2 text-gis-textPrimary">
              <span className="w-3 h-3 rounded bg-emerald-500 shrink-0" />
              Safe Relocation Parcels
            </span>
            <input
              type="checkbox"
              checked={showCandidateSites}
              onChange={e => setShowCandidateSites(e.target.checked)}
              className="rounded bg-gis-dark border-gis-border text-gis-accent focus:ring-0"
            />
          </label>

          <label className="flex items-center justify-between p-1 rounded hover:bg-gis-surface cursor-pointer">
            <span className="flex items-center gap-2 text-gis-textPrimary">
              <span className="w-3 h-3 rounded border border-dashed border-red-400 bg-red-500/20 shrink-0" />
              PostGIS Buffer Halos
            </span>
            <input
              type="checkbox"
              checked={showBufferZones}
              onChange={e => setShowBufferZones(e.target.checked)}
              className="rounded bg-gis-dark border-gis-border text-gis-accent focus:ring-0"
            />
          </label>

          {/* Phase 4 CSV Dataset Layer Toggle */}
          {!isVerifiedOnly && (
            <label className="flex items-center justify-between p-1.5 rounded bg-blue-950/30 border border-blue-800/40 hover:bg-blue-900/40 cursor-pointer">
              <span className="flex items-center gap-2 text-blue-300 font-medium">
                <span className="w-3 h-3 rounded-full bg-cyan-400 border border-white shrink-0 animate-pulse" />
                CSV Flood Points (Demo)
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-cyan-300 px-1.5 py-0.2 rounded bg-blue-900/60">
                  {csvRecordCount > 0 ? `${(csvRecordCount / 1000).toFixed(0)}k` : '10k'}
                </span>
                <input
                  type="checkbox"
                  checked={showCsvPoints}
                  onChange={e => setShowCsvPoints(e.target.checked)}
                  className="rounded bg-gis-dark border-gis-border text-cyan-400 focus:ring-0"
                />
              </div>
            </label>
          )}
        </div>

        {/* Dynamic PostGIS Buffer Slider */}
        <div className="pt-2 border-t border-gis-border space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Sliders className="w-3 h-3" /> Hazard Buffer:
            </span>
            <span className="font-mono text-gis-textPrimary font-semibold">{hazardBufferMeters}m</span>
          </div>
          <input
            type="range"
            min="50"
            max="500"
            step="25"
            value={hazardBufferMeters}
            onChange={e => setHazardBufferMeters(Number(e.target.value))}
            className="w-full accent-gis-accent bg-gis-surface h-1.5 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>50m (Immediate)</span>
            <span>250m</span>
            <span>500m (Max)</span>
          </div>
        </div>
      </div>

      {/* Floating Map Legend (Phase 4 Requirement) */}
      <div className="absolute bottom-6 left-4 z-10 bg-gis-dark/95 backdrop-blur-md border border-gis-border rounded-xl p-3 shadow-2xl transition-all">
        <div className="flex items-center justify-between gap-3 border-b border-gis-border pb-1.5 mb-2">
          <span className="text-xs font-bold text-gis-textPrimary uppercase tracking-wider flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-gis-accent" />
            GIS Hazard & Risk Legend
          </span>
          <button
            onClick={() => setShowLegend(prev => !prev)}
            className="text-slate-400 hover:text-gis-textPrimary text-xs"
          >
            {showLegend ? 'Hide' : 'Show'}
          </button>
        </div>

        {showLegend && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-sans text-gis-textPrimary">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-600 border border-white shrink-0" />
              <span>Immediate Priority (≥80)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 border border-white shrink-0" />
              <span>Short-Term (60-79)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-red-500/80 border border-red-400 shrink-0" />
              <span>Landslide Slip Corridor</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-blue-500/80 border border-blue-400 shrink-0" />
              <span>Flood Inundation Plain</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-emerald-500/80 border border-emerald-400 shrink-0" />
              <span>Safe Relocation Parcel</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded border border-dashed border-red-400 bg-red-500/20 shrink-0" />
              <span>PostGIS Exclusion Buffer</span>
            </div>
            {!isVerifiedOnly && (
              <div className="flex items-center gap-2 col-span-2 pt-1 border-t border-gis-border/60">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
                <span className="text-cyan-600 dark:text-cyan-300">CSV Flood Stations (10k dataset observations)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Feature Inspector Drawer (When feature clicked) */}
      {(selectedSettlement || selectedHazard || selectedSite || selectedCsvRecord) && (
        <div className="absolute bottom-6 right-6 z-10 w-80 sm:w-96 bg-gis-dark/95 backdrop-blur-md border border-gis-border rounded-xl p-4 shadow-2xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-gis-border">
            <span className="text-xs font-bold text-gis-textPrimary uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-gis-accent" />
              Spatial Entity Inspector
            </span>
            <button
              onClick={() => {
                setSelectedSettlement(null);
                setSelectedHazard(null);
                setSelectedSite(null);
                setSelectedCsvRecord(null);
              }}
              className="text-xs text-slate-400 hover:text-gis-textPrimary"
            >
              ✕ Close
            </button>
          </div>

          {/* CSV Flood Record Inspector */}
          {selectedCsvRecord && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gis-textPrimary">
                    Demo Flood Station #{selectedCsvRecord.rowIndex}
                  </h4>
                  <p className="text-[10px] text-cyan-400 font-mono">
                    {selectedCsvRecord.geographicZone}
                  </p>
                </div>
                <Badge
                  variant={selectedCsvRecord.floodOccurred ? 'danger' : 'info'}
                  size="sm"
                >
                  {selectedCsvRecord.floodOccurred ? 'Flood Occurred (1)' : 'No Flood (0)'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-gis-surface border border-gis-border">
                  <span className="text-slate-400 block text-[10px]">RAINFALL (MM)</span>
                  <strong className="text-gis-textPrimary flex items-center gap-1">
                    <CloudRain className="w-3 h-3 text-blue-400" />
                    {selectedCsvRecord.rainfallMm} mm
                  </strong>
                </div>
                <div className="p-2 rounded bg-gis-surface border border-gis-border">
                  <span className="text-slate-400 block text-[10px]">WATER LEVEL (M)</span>
                  <strong className="text-gis-textPrimary flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-cyan-400" />
                    {selectedCsvRecord.waterLevelM} m
                  </strong>
                </div>
                <div className="p-2 rounded bg-gis-surface border border-gis-border">
                  <span className="text-slate-400 block text-[10px]">RIVER DISCHARGE</span>
                  <strong className="text-gis-textPrimary">
                    {selectedCsvRecord.riverDischargeM3s.toFixed(0)} m³/s
                  </strong>
                </div>
                <div className="p-2 rounded bg-gis-surface border border-gis-border">
                  <span className="text-slate-400 block text-[10px]">ELEVATION</span>
                  <strong className="text-gis-textPrimary">
                    {selectedCsvRecord.elevationM.toFixed(0)} m
                  </strong>
                </div>
              </div>

              <div className="p-2 rounded bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-200">
                <strong>Provenance Notice:</strong> Synthetic benchmark record from{' '}
                <code>docs/flood_risk_dataset_india.csv</code>. Tagged <code>isVerified = false</code> for demo simulation.
              </div>

              <VerificationBadge
                isVerified={false}
                dataSource="docs/flood_risk_dataset_india.csv (Mock/Demo)"
                showSource
              />
            </div>
          )}

          {/* Vulnerable Settlement Inspector */}
          {selectedSettlement && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gis-textPrimary">{selectedSettlement.name}</h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {selectedSettlement.district} • Lat: {selectedSettlement.coordinates.lat.toFixed(4)}, Lng: {selectedSettlement.coordinates.lng.toFixed(4)}
                  </p>
                </div>
                <Badge
                  variant={
                    selectedSettlement.priorityHorizon === 'immediate'
                      ? 'danger'
                      : selectedSettlement.priorityHorizon === 'short_term'
                        ? 'warning'
                        : 'primary'
                  }
                  size="sm"
                  pulse={selectedSettlement.priorityHorizon === 'immediate'}
                >
                  {selectedSettlement.priorityHorizon.toUpperCase()}
                </Badge>
              </div>

              {/* Red Zone Containment Alert */}
              {trappedAnalysis.trappedMap.has(selectedSettlement.id) ? (
                <div className="p-2.5 rounded-lg bg-red-950/70 border border-red-700/80 text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <div>
                    <strong className="block text-gis-textPrimary">Trapped in Hazard Red Zone</strong>
                    <span>
                      Within {hazardBufferMeters}m perimeter buffer of{' '}
                      {trappedAnalysis.trappedMap.get(selectedSettlement.id)?.hazardType}. Relocation is non-negotiable.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Outside active {hazardBufferMeters}m hazard boundary</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-gis-surface border border-gis-border">
                  <span className="text-slate-400 block text-[10px]">AHP RISK SCORE</span>
                  <strong className="text-red-400 text-base">{selectedSettlement.calculatedRiskScore} / 100</strong>
                </div>
                <div className="p-2 rounded bg-gis-surface border border-gis-border">
                  <span className="text-slate-400 block text-[10px]">POPULATION</span>
                  <strong className="text-gis-textPrimary text-base">{selectedSettlement.totalPopulation.toLocaleString()}</strong>
                </div>
                <div className="p-2 rounded bg-gis-surface border border-gis-border">
                  <span className="text-slate-400 block text-[10px]">HOUSEHOLDS</span>
                  <strong className="text-gis-textPrimary">{selectedSettlement.householdCount} families</strong>
                </div>
                <div className="p-2 rounded bg-gis-surface border border-gis-border">
                  <span className="text-slate-400 block text-[10px]">KUCCHA HOUSING</span>
                  <strong className="text-amber-400">{selectedSettlement.kucchaHousesPct}%</strong>
                </div>
              </div>

              {/* Nearest Relocation Parcel Matcher */}
              {nearestCandidateSite && (
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 space-y-1.5 text-xs">
                  <span className="text-[10px] text-emerald-400 uppercase font-mono block font-bold flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Nearest Safe Relocation Parcel
                  </span>
                  <div className="flex justify-between items-center text-gis-textPrimary">
                    <span className="font-semibold text-gis-textPrimary">
                      {nearestCandidateSite.site.locationName}
                    </span>
                    <span className="font-mono text-emerald-300 font-bold">
                      {nearestCandidateSite.distanceKm} km
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300">
                    Usable: {(nearestCandidateSite.site.usableAreaSqm / 1000).toFixed(0)}k m² | Absorptive capacity:{' '}
                    {nearestCandidateSite.site.maxCarryingCapacityPop.toLocaleString()} pop
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full mt-1 text-xs"
                    icon={<ArrowRight className="w-3.5 h-3.5" />}
                    onClick={() => setCurrentRoute('reports')}
                  >
                    Draft Relocation Order to this Site
                  </Button>
                </div>
              )}

              <VerificationBadge
                isVerified={selectedSettlement.isVerified}
                dataSource={selectedSettlement.dataSource}
                showSource
              />
            </div>
          )}

          {/* Hazard Zone Inspector */}
          {selectedHazard && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gis-textPrimary uppercase">
                  {selectedHazard.hazardType.replace(/_/g, ' ')}
                </h4>
                <Badge variant="danger" size="sm">
                  {selectedHazard.severity}
                </Badge>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{selectedHazard.description}</p>
              <div className="text-xs font-mono space-y-1 text-slate-400">
                <p>
                  Core Surface Area:{' '}
                  <strong className="text-gis-textPrimary">{selectedHazard.areaSqKm} km²</strong>
                </p>
                <p>
                  Active Exclusion Buffer:{' '}
                  <strong className="text-gis-textPrimary">{hazardBufferMeters}m</strong>
                </p>
                <p>
                  Return Period:{' '}
                  <strong className="text-gis-textPrimary">
                    {selectedHazard.returnPeriodYears ? `${selectedHazard.returnPeriodYears} years` : 'Monsoon Periodic'}
                  </strong>
                </p>
              </div>
              <VerificationBadge
                isVerified={selectedHazard.isVerified}
                dataSource={selectedHazard.dataSource}
                showSource
              />
            </div>
          )}

          {/* Candidate Relocation Site Inspector */}
          {selectedSite && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gis-textPrimary">{selectedSite.locationName}</h4>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Site Code: {selectedSite.siteCode} • District: {selectedSite.district}
                  </p>
                </div>
                <Badge variant="success" size="sm">
                  Suitability {selectedSite.suitabilityScore}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-gis-surface border border-gis-border">
                  <span className="text-slate-400 block text-[10px]">CARRYING CAPACITY</span>
                  <strong className="text-emerald-400">
                    {selectedSite.maxCarryingCapacityPop.toLocaleString()} pop
                  </strong>
                </div>
                <div className="p-2 rounded bg-gis-surface border border-gis-border">
                  <span className="text-slate-400 block text-[10px]">AVG TERRAIN SLOPE</span>
                  <strong className="text-gis-textPrimary">
                    {selectedSite.avgSlopeDegrees}° (
                    {selectedSite.avgSlopeDegrees <= 15 ? 'Cleared' : 'Restricted'})
                  </strong>
                </div>
                <div className="p-2 rounded bg-gis-surface border border-gis-border">
                  <span className="text-slate-400 block text-[10px]">USABLE AREA</span>
                  <strong className="text-gis-textPrimary">
                    {(selectedSite.usableAreaSqm / 1000).toFixed(0)}k m²
                  </strong>
                </div>
                <div className="p-2 rounded bg-gis-surface border border-gis-border">
                  <span className="text-slate-400 block text-[10px]">ROAD DISTANCE</span>
                  <strong className="text-gis-textPrimary">{selectedSite.distanceToPrimaryRoadM}m</strong>
                </div>
              </div>

              <div className="space-y-1">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full text-xs"
                  icon={<Eye className="w-3.5 h-3.5" />}
                  onClick={() => setCurrentRoute('relocation-sites')}
                >
                  Open Cadastral Capacity Dossier
                </Button>
              </div>

              <VerificationBadge
                isVerified={selectedSite.isVerified}
                dataSource={selectedSite.dataSource}
                showSource
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
