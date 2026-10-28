import { GeoPoint, VulnerableSettlement, HazardZone, PriorityHorizon } from '../types/gis.types';

/**
 * SURAKSHAGIS COMPUTATIONAL GEOMETRY & AHP DECISION SUPPORT ENGINE
 *
 * Implements deterministic client-side spatial algorithms and AHP multi-criteria
 * decision models that mirror PostGIS RPC behavior when operating in local/fallback mode.
 */

// Earth radius in meters
const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates Great-Circle distance between two points in meters using Haversine formula
 */
export function calculateHaversineDistanceMeters(p1: GeoPoint, p2: GeoPoint): number {
  const lat1Rad = (p1.lat * Math.PI) / 180;
  const lat2Rad = (p2.lat * Math.PI) / 180;
  const deltaLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const deltaLng = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Ray-casting algorithm to test whether a GeoPoint lies inside a polygon
 */
export function isPointInsidePolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculates the shortest distance in meters from a point to a polygon perimeter
 */
export function distanceToPolygonPerimeterMeters(point: GeoPoint, polygon: GeoPoint[]): number {
  if (polygon.length === 0) return Infinity;
  if (isPointInsidePolygon(point, polygon)) return 0;

  let minDistance = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    // Compute distance to line segment p1-p2
    const d = distanceToSegmentMeters(point, p1, p2);
    if (d < minDistance) {
      minDistance = d;
    }
  }

  return minDistance;
}

/**
 * Helper to compute distance from point P to line segment AB in meters
 */
function distanceToSegmentMeters(p: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  // Approximate flat-earth projection relative to point A for local segment computation
  const cosLat = Math.cos((a.lat * Math.PI) / 180);
  const degToMetersLat = 111139;
  const degToMetersLng = 111139 * cosLat;

  const px = (p.lng - a.lng) * degToMetersLng;
  const py = (p.lat - a.lat) * degToMetersLat;
  const bx = (b.lng - a.lng) * degToMetersLng;
  const by = (b.lat - a.lat) * degToMetersLat;

  const l2 = bx * bx + by * by;
  if (l2 === 0) return Math.hypot(px, py);

  let t = (px * bx + py * by) / l2;
  t = Math.max(0, Math.min(1, t));

  const projX = t * bx;
  const projY = t * by;

  return Math.hypot(px - projX, py - projY);
}

/**
 * Calculates geographic centroid of a polygon
 */
export function calculatePolygonCentroid(coords: GeoPoint[]): GeoPoint {
  if (coords.length === 0) return { lat: 0, lng: 0 };
  let sumLat = 0;
  let sumLng = 0;
  for (const c of coords) {
    sumLat += c.lat;
    sumLng += c.lng;
  }
  return {
    lat: sumLat / coords.length,
    lng: sumLng / coords.length,
  };
}

/**
 * Generates an expanded buffer polygon around a polygon for visual map rendering
 * (Simulates PostGIS ST_Buffer(geom, bufferMeters))
 */
export function generateBufferedPolygon(coords: GeoPoint[], bufferMeters: number): GeoPoint[] {
  if (coords.length < 3 || bufferMeters <= 0) return coords;

  const centroid = calculatePolygonCentroid(coords);
  const cosLat = Math.cos((centroid.lat * Math.PI) / 180);
  const deltaLat = bufferMeters / 111139;
  const deltaLng = bufferMeters / (111139 * (cosLat || 1));

  // Expand each vertex away from the centroid by the buffer distance
  return coords.map(vertex => {
    const dirLat = vertex.lat - centroid.lat;
    const dirLng = vertex.lng - centroid.lng;
    const len = Math.hypot(dirLat, dirLng * cosLat) || 1;

    return {
      lat: vertex.lat + (dirLat / len) * deltaLat,
      lng: vertex.lng + (dirLng / len) * deltaLng,
    };
  });
}

/**
 * Evaluates whether a settlement lies within a hazard zone or within its buffer
 */
export interface HazardIntersectionResult {
  isTrappedInRedZone: boolean;
  distanceToPerimeterM: number;
  intersectingHazardId?: string;
  intersectingHazardType?: string;
}

export function checkSettlementHazardIntersection(
  settlement: VulnerableSettlement,
  hazardZones: HazardZone[],
  bufferMeters: number
): HazardIntersectionResult {
  for (const hz of hazardZones) {
    if (hz.coordinates.length < 3) continue;

    // Check direct polygon containment
    if (isPointInsidePolygon(settlement.coordinates, hz.coordinates)) {
      return {
        isTrappedInRedZone: true,
        distanceToPerimeterM: 0,
        intersectingHazardId: hz.id,
        intersectingHazardType: hz.hazardType,
      };
    }

    // Check perimeter distance vs enforced buffer
    const dist = distanceToPolygonPerimeterMeters(settlement.coordinates, hz.coordinates);
    const effectiveBuffer = Math.max(bufferMeters, hz.bufferZoneMeters || 0);

    if (dist <= effectiveBuffer) {
      return {
        isTrappedInRedZone: true,
        distanceToPerimeterM: Math.round(dist),
        intersectingHazardId: hz.id,
        intersectingHazardType: hz.hazardType,
      };
    }
  }

  return {
    isTrappedInRedZone: false,
    distanceToPerimeterM: Infinity,
  };
}

/**
 * AHP (Analytical Hierarchy Process) Consistency & Scoring Module
 * Evaluates 3 Core Criteria:
 * C1: Hazard Intensity
 * C2: Demographic Vulnerability
 * C3: Historical Frequency
 */
export interface AhpConsistencyResult {
  weights: { hazard: number; demographic: number; history: number };
  lambdaMax: number;
  consistencyIndex: number;
  consistencyRatio: number;
  isConsistent: boolean; // CR < 0.10 is mathematically consistent
}

export function evaluateAhpConsistency(
  pHazardVsDemo: number, // 1 to 9 (or 1/9 to 1)
  pHazardVsHist: number,
  pDemoVsHist: number
): AhpConsistencyResult {
  // Construct 3x3 Reciprocal Pairwise Comparison Matrix
  const a = [
    [1, pHazardVsDemo, pHazardVsHist],
    [1 / pHazardVsDemo, 1, pDemoVsHist],
    [1 / pHazardVsHist, 1 / pDemoVsHist, 1],
  ];

  // Column Sums
  const colSums = [
    a[0][0] + a[1][0] + a[2][0],
    a[0][1] + a[1][1] + a[2][1],
    a[0][2] + a[1][2] + a[2][2],
  ];

  // Normalized Matrix & Priority Weights (Eigenvector approximation)
  const norm = [
    [a[0][0] / colSums[0], a[0][1] / colSums[1], a[0][2] / colSums[2]],
    [a[1][0] / colSums[0], a[1][1] / colSums[1], a[1][2] / colSums[2]],
    [a[2][0] / colSums[0], a[2][1] / colSums[1], a[2][2] / colSums[2]],
  ];

  const wHazard = (norm[0][0] + norm[0][1] + norm[0][2]) / 3;
  const wDemo = (norm[1][0] + norm[1][1] + norm[1][2]) / 3;
  const wHist = (norm[2][0] + norm[2][1] + norm[2][2]) / 3;

  // Principal Eigenvalue (lambda_max)
  const lambdaMax =
    colSums[0] * wHazard + colSums[1] * wDemo + colSums[2] * wHist;

  // Consistency Index: CI = (lambda_max - n) / (n - 1), where n = 3
  const ci = (lambdaMax - 3) / 2;

  // Saaty Random Index for n = 3 is 0.58
  const RI_N3 = 0.58;
  const cr = ci / RI_N3;

  return {
    weights: {
      hazard: Math.round(wHazard * 100),
      demographic: Math.round(wDemo * 100),
      history: Math.round(wHist * 100),
    },
    lambdaMax: Number(lambdaMax.toFixed(3)),
    consistencyIndex: Number(ci.toFixed(4)),
    consistencyRatio: Number(Math.max(0, cr).toFixed(4)),
    isConsistent: cr < 0.1,
  };
}

/**
 * Computes Dynamic Composite Risk Score and Priority Horizon for a settlement
 */
export function computeSettlementAhpScore(
  settlement: VulnerableSettlement,
  weightHazard: number, // 0 - 100
  weightDemographic: number,
  weightHistory: number
): { score: number; horizon: PriorityHorizon; subScores: { hazard: number; vulnerability: number; history: number } } {
  // Normalize weights
  const total = weightHazard + weightDemographic + weightHistory || 100;
  const wH = weightHazard / total;
  const wD = weightDemographic / total;
  const wHist = weightHistory / total;

  // 1. Hazard Severity Score (0 - 100)
  let hScore = 65;
  switch (settlement.primaryHazardExposure) {
    case 'cloudburst_flash_flood':
      hScore = 95;
      break;
    case 'landslide':
      hScore = 90;
      break;
    case 'riverine_flood':
      hScore = 75;
      break;
    case 'cyclone_surge':
      hScore = 80;
      break;
    case 'coastal_erosion':
      hScore = 70;
      break;
  }

  // 2. Demographic Vulnerability Score (0 - 100)
  const pop = Math.max(1, settlement.totalPopulation);
  const dependentRatio = (settlement.elderlyCount + settlement.childrenCount) / pop;
  const vScore = Math.min(
    100,
    settlement.kucchaHousesPct * 0.5 +
      dependentRatio * 100 * 0.3 +
      Math.min(settlement.historicalEventCount, 5) * 4
  );

  // 3. Historical Disaster Exposure (0 - 100)
  const histScore = Math.min(100, settlement.historicalEventCount * 20);

  // Composite synthesis
  const compositeScore = Math.round(hScore * wH + vScore * wD + histScore * wHist);

  // Determine horizon
  let horizon: PriorityHorizon = 'medium_term';
  if (compositeScore >= 80) {
    horizon = 'immediate';
  } else if (compositeScore >= 60) {
    horizon = 'short_term';
  } else if (compositeScore < 40) {
    horizon = 'monitoring';
  }

  return {
    score: compositeScore,
    horizon,
    subScores: {
      hazard: Math.round(hScore),
      vulnerability: Math.round(vScore),
      history: Math.round(histScore),
    },
  };
}

/**
 * CARRYING CAPACITY ASSESSMENT EVALUATOR
 * Strict compliance with National Building Code (NBC) / SP 7 planning standards
 * and PostGIS RPC fn_assess_carrying_capacity
 */
export interface CarryingCapacityEvaluation {
  totalAreaSqm: number;
  grossUsableAreaSqm: number;
  hazardOverlapSqm: number;
  netUsableAreaSqm: number;
  slopeDegrees: number;
  slopePenaltyApplied: boolean;
  perCapitaGrossSqm: number;
  maxCarryingCapacityPop: number;
  allocatedPop: number;
  remainingCapacityMargin: number;
  isViable: boolean;
  notes: string[];
}

export function evaluateCarryingCapacity(params: {
  totalAreaSqm: number;
  avgSlopeDegrees: number;
  perCapitaGrossSqm?: number;
  currentAllocatedPop?: number;
  hazardOverlapSqm?: number;
}): CarryingCapacityEvaluation {
  const perCapitaGrossSqm = params.perCapitaGrossSqm ?? 45.0;
  const allocatedPop = params.currentAllocatedPop ?? 0;
  const hazardOverlap = params.hazardOverlapSqm ?? 0;
  const notes: string[] = [];

  // Deduct 25% for essential access roads, green buffers, and utility corridors
  const grossUsable = params.totalAreaSqm * 0.75;
  notes.push('Deducted 25% gross area for arterial roads, drainage networks, and setbacks.');

  // Deduct 100% of hazard overlap
  let netUsable = Math.max(0, grossUsable - hazardOverlap);
  if (hazardOverlap > 0) {
    notes.push(`Deducted ${hazardOverlap.toLocaleString()} m² for intersecting hazard buffers.`);
  }

  // Terrain slope penalty: If average slope exceeds 15°, penalize buildability by 40%
  let slopePenaltyApplied = false;
  if (params.avgSlopeDegrees > 15) {
    slopePenaltyApplied = true;
    netUsable *= 0.6;
    notes.push(
      `Slope penalty triggered (${params.avgSlopeDegrees.toFixed(1)}° > 15° threshold): Usable buildable area reduced by 40%.`
    );
  } else {
    notes.push(
      `Terrain slope validated (${params.avgSlopeDegrees.toFixed(1)}° ≤ 15° threshold): Full structural buildability cleared.`
    );
  }

  // Max absorbable population based on NBC SP 7 norm
  const maxCapacity = Math.floor(netUsable / perCapitaGrossSqm);
  const remainingMargin = maxCapacity - allocatedPop;
  const isViable = maxCapacity >= 100 && params.avgSlopeDegrees < 25;

  return {
    totalAreaSqm: params.totalAreaSqm,
    grossUsableAreaSqm: Math.round(grossUsable),
    hazardOverlapSqm: hazardOverlap,
    netUsableAreaSqm: Math.round(netUsable),
    slopeDegrees: params.avgSlopeDegrees,
    slopePenaltyApplied,
    perCapitaGrossSqm,
    maxCarryingCapacityPop: maxCapacity,
    allocatedPop,
    remainingCapacityMargin: remainingMargin,
    isViable,
    notes,
  };
}
