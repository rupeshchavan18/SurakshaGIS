import { PriorityHorizon } from './gis.types';

/**
 * Raw 14-column CSV row representation from `docs/flood_risk_dataset_india.csv`
 */
export interface RawFloodRiskCsvRow {
  Latitude: string;
  Longitude: string;
  'Rainfall (mm)': string;
  'Temperature (°C)': string;
  'Humidity (%)': string;
  'River Discharge (m³/s)': string;
  'Water Level (m)': string;
  'Elevation (m)': string;
  'Land Cover': string;
  'Soil Type': string;
  'Population Density': string;
  Infrastructure: string;
  'Historical Floods': string;
  'Flood Occurred': string;
}

export type CsvLandCover = 'Water Body' | 'Forest' | 'Agricultural' | 'Desert' | 'Urban';
export type CsvSoilType = 'Clay' | 'Peat' | 'Loam' | 'Sandy' | 'Silt';

/**
 * Validated, typed record parsed from the authentic CSV row.
 * Preserves all 14 original columns without mutation.
 */
export interface ValidatedFloodRiskRecord {
  id: string;
  rowIndex: number;
  latitude: number;
  longitude: number;
  rainfallMm: number;
  temperatureC: number;
  humidityPct: number;
  riverDischargeM3s: number;
  waterLevelM: number;
  elevationM: number;
  landCover: CsvLandCover;
  soilType: CsvSoilType;
  populationDensity: number;
  hasInfrastructure: boolean; // Infrastructure === 1
  historicalFloodsCount: number; // Historical Floods (0 or 1)
  floodOccurred: boolean; // Flood Occurred === 1
  calculatedRiskScore: number; // Normalized 0 - 100 risk score
  priorityHorizon: PriorityHorizon;
  geographicZone: string;
  isVerified: false; // Strictly false: mock/demo provenance
  dataSource: string;
}

/**
 * Validation failure record for invalid/malformed rows
 */
export interface CsvRowValidationError {
  rowIndex: number;
  column: string;
  rawValue: string;
  reason: string;
}

/**
 * Complete Data Quality and Validation Report
 */
export interface CsvValidationReport {
  filePath: string;
  fileSizeBytes: number;
  totalLines: number;
  headerColumns: string[];
  totalParsedRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  duplicateCoordinatesCount: number;
  missingValuesCountByColumn: Record<string, number>;
  validationErrors: CsvRowValidationError[];
  coordinateBounds: {
    latMin: number;
    latMax: number;
    lonMin: number;
    lonMax: number;
    isWithinIndiaBounds: boolean;
  };
  attributeRanges: {
    rainfallMm: { min: number; max: number; avg: number };
    temperatureC: { min: number; max: number; avg: number };
    humidityPct: { min: number; max: number; avg: number };
    riverDischargeM3s: { min: number; max: number; avg: number };
    waterLevelM: { min: number; max: number; avg: number };
    elevationM: { min: number; max: number; avg: number };
    populationDensity: { min: number; max: number; avg: number };
  };
  distributionCounts: {
    landCover: Record<string, number>;
    soilType: Record<string, number>;
    infrastructurePresent: number;
    historicalFloodsPresent: number;
    floodOccurredPositive: number;
  };
  parsedAtTimestamp: string;
}

/**
 * Explicit Column Mapping Specification Item
 */
export interface CsvColumnMappingSpec {
  csvColumn: string;
  sampleValue: string;
  dataType: string;
  applicationModel: string;
  targetField: string;
  transformationLogic: string;
  provenanceCategory: 'Demo Observation' | 'Derived Metric' | 'Simulation Label';
}

/**
 * Filter options for querying the CSV records
 */
export interface CsvFilterOptions {
  searchQuery?: string;
  landCover?: CsvLandCover | 'all';
  soilType?: CsvSoilType | 'all';
  floodOccurredFilter?: 'all' | 'flood' | 'no_flood';
  horizonFilter?: PriorityHorizon | 'all';
  geographicZone?: string | 'all';
  minRainfall?: number;
  maxRainfall?: number;
  sortBy?: 'riskScore' | 'rainfall' | 'discharge' | 'waterLevel' | 'popDensity' | 'elevation' | 'rowIndex';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

/**
 * State of the CSV dataset in the application
 */
export type CsvLoadState = 'idle' | 'loading' | 'success' | 'error' | 'empty';
