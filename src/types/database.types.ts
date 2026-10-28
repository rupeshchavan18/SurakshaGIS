export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type HazardTypeEnum =
  | 'landslide'
  | 'riverine_flood'
  | 'cloudburst_flash_flood'
  | 'coastal_erosion'
  | 'cyclone_surge';

export type SeverityLevelEnum = 'low' | 'moderate' | 'high' | 'severe' | 'catastrophic';

export type PriorityHorizonEnum = 'immediate' | 'short_term' | 'medium_term' | 'monitoring';

export type UserRoleEnum = 'sdma_admin' | 'district_planner' | 'field_surveyor' | 'public_viewer';

export type PlanStatusEnum = 'DRAFT' | 'UNDER_REVIEW' | 'SDMA_APPROVED' | 'EXECUTING' | 'COMPLETED';

export type ImportStatusEnum = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role: UserRoleEnum;
          department: string | null;
          district: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          role?: UserRoleEnum;
          department?: string | null;
          district?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          role?: UserRoleEnum;
          department?: string | null;
          district?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      administrative_boundaries: {
        Row: {
          id: string;
          state_name: string;
          district_name: string;
          subdistrict_name: string | null;
          census_code: string | null;
          geom: unknown; // GeoJSON / Geometry
          is_verified: boolean;
          data_source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          state_name: string;
          district_name: string;
          subdistrict_name?: string | null;
          census_code?: string | null;
          geom: unknown;
          is_verified?: boolean;
          data_source: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          state_name?: string;
          district_name?: string;
          subdistrict_name?: string | null;
          census_code?: string | null;
          geom?: unknown;
          is_verified?: boolean;
          data_source?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      vulnerable_settlements: {
        Row: {
          id: string;
          name: string;
          district: string;
          subdistrict: string | null;
          geom: unknown; // PostGIS Point (EPSG:4326)
          boundary_geom: unknown | null;
          total_population: number;
          household_count: number;
          elderly_count: number;
          children_count: number;
          kuccha_houses_pct: number;
          historical_event_count: number;
          primary_hazard_exposure: HazardTypeEnum;
          calculated_risk_score: number;
          priority_horizon: PriorityHorizonEnum;
          is_verified: boolean;
          data_source: string;
          verified_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          district: string;
          subdistrict?: string | null;
          geom: unknown;
          boundary_geom?: unknown | null;
          total_population: number;
          household_count: number;
          elderly_count?: number;
          children_count?: number;
          kuccha_houses_pct?: number;
          historical_event_count?: number;
          primary_hazard_exposure: HazardTypeEnum;
          calculated_risk_score?: number;
          priority_horizon?: PriorityHorizonEnum;
          is_verified?: boolean;
          data_source: string;
          verified_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          district?: string;
          subdistrict?: string | null;
          geom?: unknown;
          boundary_geom?: unknown | null;
          total_population?: number;
          household_count?: number;
          elderly_count?: number;
          children_count?: number;
          kuccha_houses_pct?: number;
          historical_event_count?: number;
          primary_hazard_exposure?: HazardTypeEnum;
          calculated_risk_score?: number;
          priority_horizon?: PriorityHorizonEnum;
          is_verified?: boolean;
          data_source?: string;
          verified_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      hazard_zones: {
        Row: {
          id: string;
          hazard_type: HazardTypeEnum;
          severity: SeverityLevelEnum;
          return_period_years: number | null;
          description: string | null;
          geom: unknown; // PostGIS Polygon (EPSG:4326)
          centroid: unknown | null;
          buffer_zone_meters: number;
          area_sqkm: number | null;
          is_verified: boolean;
          data_source: string;
          verified_by: string | null;
          valid_from: string | null;
          valid_until: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          hazard_type: HazardTypeEnum;
          severity: SeverityLevelEnum;
          return_period_years?: number | null;
          description?: string | null;
          geom: unknown;
          centroid?: unknown | null;
          buffer_zone_meters?: number;
          area_sqkm?: number | null;
          is_verified?: boolean;
          data_source: string;
          verified_by?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          hazard_type?: HazardTypeEnum;
          severity?: SeverityLevelEnum;
          return_period_years?: number | null;
          description?: string | null;
          geom?: unknown;
          centroid?: unknown | null;
          buffer_zone_meters?: number;
          area_sqkm?: number | null;
          is_verified?: boolean;
          data_source?: string;
          verified_by?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      candidate_relocation_sites: {
        Row: {
          id: string;
          site_code: string;
          location_name: string;
          district: string;
          geom: unknown; // PostGIS Polygon (EPSG:4326)
          centroid: unknown; // PostGIS Point (EPSG:4326)
          total_area_sqm: number;
          usable_area_sqm: number;
          avg_slope_degrees: number;
          distance_to_primary_road_m: number;
          distance_to_water_source_m: number;
          distance_to_nearest_hospital_km: number;
          distance_to_nearest_school_km: number;
          max_carrying_capacity_pop: number;
          current_allocated_pop: number;
          suitability_score: number;
          land_ownership_type: string;
          is_verified: boolean;
          data_source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_code: string;
          location_name: string;
          district: string;
          geom: unknown;
          centroid: unknown;
          total_area_sqm: number;
          usable_area_sqm: number;
          avg_slope_degrees: number;
          distance_to_primary_road_m: number;
          distance_to_water_source_m: number;
          distance_to_nearest_hospital_km: number;
          distance_to_nearest_school_km: number;
          max_carrying_capacity_pop: number;
          current_allocated_pop?: number;
          suitability_score?: number;
          land_ownership_type: string;
          is_verified?: boolean;
          data_source: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_code?: string;
          location_name?: string;
          district?: string;
          geom?: unknown;
          centroid?: unknown;
          total_area_sqm?: number;
          usable_area_sqm?: number;
          avg_slope_degrees?: number;
          distance_to_primary_road_m?: number;
          distance_to_water_source_m?: number;
          distance_to_nearest_hospital_km?: number;
          distance_to_nearest_school_km?: number;
          max_carrying_capacity_pop?: number;
          current_allocated_pop?: number;
          suitability_score?: number;
          land_ownership_type?: string;
          is_verified?: boolean;
          data_source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      risk_assessments: {
        Row: {
          id: string;
          settlement_id: string;
          assessed_by: string | null;
          hazard_score: number;
          vulnerability_score: number;
          coping_capacity_score: number;
          composite_risk_score: number;
          recommended_horizon: PriorityHorizonEnum;
          ahp_weights_json: Json | null;
          notes: string | null;
          assessment_date: string;
        };
        Insert: {
          id?: string;
          settlement_id: string;
          assessed_by?: string | null;
          hazard_score: number;
          vulnerability_score: number;
          coping_capacity_score: number;
          composite_risk_score: number;
          recommended_horizon: PriorityHorizonEnum;
          ahp_weights_json?: Json | null;
          notes?: string | null;
          assessment_date?: string;
        };
        Update: {
          id?: string;
          settlement_id?: string;
          assessed_by?: string | null;
          hazard_score?: number;
          vulnerability_score?: number;
          coping_capacity_score?: number;
          composite_risk_score?: number;
          recommended_horizon?: PriorityHorizonEnum;
          ahp_weights_json?: Json | null;
          notes?: string | null;
          assessment_date?: string;
        };
        Relationships: [];
      };
      relocation_action_plans: {
        Row: {
          id: string;
          plan_code: string;
          settlement_id: string;
          target_site_id: string;
          assigned_horizon: PriorityHorizonEnum;
          households_to_relocate: number;
          estimated_budget_inr: number;
          justification_summary: string | null;
          status: PlanStatusEnum;
          created_by: string | null;
          approved_by: string | null;
          approval_date: string | null;
          is_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_code: string;
          settlement_id: string;
          target_site_id: string;
          assigned_horizon: PriorityHorizonEnum;
          households_to_relocate: number;
          estimated_budget_inr: number;
          justification_summary?: string | null;
          status?: PlanStatusEnum;
          created_by?: string | null;
          approved_by?: string | null;
          approval_date?: string | null;
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_code?: string;
          settlement_id?: string;
          target_site_id?: string;
          assigned_horizon?: PriorityHorizonEnum;
          households_to_relocate?: number;
          estimated_budget_inr?: number;
          justification_summary?: string | null;
          status?: PlanStatusEnum;
          created_by?: string | null;
          approved_by?: string | null;
          approval_date?: string | null;
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      dataset_imports: {
        Row: {
          id: string;
          filename: string;
          source_type: string;
          total_records: number;
          valid_records: number;
          error_records: number;
          imported_by: string | null;
          status: ImportStatusEnum;
          validation_report_json: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          filename: string;
          source_type?: string;
          total_records: number;
          valid_records: number;
          error_records: number;
          imported_by?: string | null;
          status?: ImportStatusEnum;
          validation_report_json?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          filename?: string;
          source_type?: string;
          total_records?: number;
          valid_records?: number;
          error_records?: number;
          imported_by?: string | null;
          status?: ImportStatusEnum;
          validation_report_json?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      spatial_audit_logs: {
        Row: {
          id: string;
          action: string;
          affected_table: string;
          record_id: string;
          performed_by: string | null;
          old_data: Json | null;
          new_data: Json | null;
          ip_address: string | null;
          timestamp: string;
        };
        Insert: {
          id?: string;
          action: string;
          affected_table: string;
          record_id: string;
          performed_by?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          ip_address?: string | null;
          timestamp?: string;
        };
        Update: {
          id?: string;
          action?: string;
          affected_table?: string;
          record_id?: string;
          performed_by?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          ip_address?: string | null;
          timestamp?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      fn_compute_red_zones: {
        Args: {
          p_hazard_types?: string[];
          p_min_severity?: string;
          p_buffer_meters?: number;
        };
        Returns: {
          red_zone_geojson: string;
          total_area_sqkm: number;
          hazard_composition: string;
          intersected_zones_count: number;
        }[];
      };
      fn_assess_carrying_capacity: {
        Args: {
          p_site_id: string;
          p_per_capita_gross_sqm?: number;
        };
        Returns: Json;
      };
      fn_rank_relocation_priority: {
        Args: {
          p_weight_hazard?: number;
          p_weight_demographic?: number;
          p_weight_history?: number;
        };
        Returns: {
          settlement_id: string;
          settlement_name: string;
          district: string;
          population: number;
          hazard_score: number;
          vulnerability_score: number;
          composite_risk_score: number;
          recommended_horizon: PriorityHorizonEnum;
        }[];
      };
      fn_get_habitations_within_hazard_buffer: {
        Args: {
          p_hazard_id: string;
          p_buffer_meters?: number;
        };
        Returns: {
          settlement_id: string;
          settlement_name: string;
          district: string;
          population: number;
          distance_meters: number;
          calculated_risk_score: number;
        }[];
      };
      fn_get_spatial_metrics: {
        Args: {
          p_verified_only?: boolean;
        };
        Returns: Json;
      };
    };
    Enums: {
      hazard_type_enum: HazardTypeEnum;
      severity_level_enum: SeverityLevelEnum;
      priority_horizon_enum: PriorityHorizonEnum;
      user_role_enum: UserRoleEnum;
      plan_status_enum: PlanStatusEnum;
      import_status_enum: ImportStatusEnum;
    };
  };
}
