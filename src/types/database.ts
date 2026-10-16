import { z } from 'zod';
import { AuditAction, AuditLogDetails } from './audit';
import { DeletionTaskStatus } from './deletion';
import { Dossier } from './dossier';
import { CreateJobPayload, JobProgressDetails } from './jobs';
import { NotaryRole } from './organization';
import { StepState, WorkflowStepDefinition } from './workflow';

export const DB_TABLES = {
  ORGANIZATIONS: 'organizations',
  ORGANIZATION_MEMBERS: 'organization_members',
  PROFILES: 'profiles',
  DOCUMENTS: 'documents',
  DOSSIER_JOBS: 'dossier_jobs',
  AUDIT_LOGS: 'audit_logs',
  KNOWLEDGE_DOCUMENTS: 'knowledge_documents',
  WORKFLOW_DEFINITIONS: 'workflow_definitions',
  WORKFLOW_INSTANCES: 'workflow_instances',
  DELETION_TASKS: 'deletion_tasks',
  AUDIT_ACTOR_MAP: 'audit_actor_map',
  LLM_USAGE: 'llm_usage',
} as const;

export const DbTableSchema = z.enum([
  DB_TABLES.ORGANIZATIONS,
  DB_TABLES.ORGANIZATION_MEMBERS,
  DB_TABLES.PROFILES,
  DB_TABLES.DOCUMENTS,
  DB_TABLES.DOSSIER_JOBS,
  DB_TABLES.AUDIT_LOGS,
  DB_TABLES.KNOWLEDGE_DOCUMENTS,
  DB_TABLES.WORKFLOW_DEFINITIONS,
  DB_TABLES.WORKFLOW_INSTANCES,
  DB_TABLES.DELETION_TASKS,
  DB_TABLES.AUDIT_ACTOR_MAP,
  DB_TABLES.LLM_USAGE,
]);
export type DbTable = (typeof DB_TABLES)[keyof typeof DB_TABLES];

export { DbUuidSchema, PG_UUID_REGEX } from './primitives';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          official_seat: string;
          chamber_district: string;
          tax_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          official_seat: string;
          chamber_district: string;
          tax_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          official_seat?: string;
          chamber_district?: string;
          tax_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          role: NotaryRole;
          joined_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          role?: NotaryRole;
          joined_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string | null;
          role?: NotaryRole;
          joined_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          status: string;
          content: Dossier;
          retention_anchor_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          title: string;
          status: string;
          content: Dossier;
          retention_anchor_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          title?: string;
          status?: string;
          content?: Dossier;
          retention_anchor_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      dossier_jobs: {
        Row: {
          id: string;
          organization_id: string | null;
          status: string;
          stage: string | null;
          progress_details: JobProgressDetails | null;
          payload: CreateJobPayload;
          result_dossier_id: string | null;
          error_message: string | null;
          retry_count: number;
          max_retries: number;
          locked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          status: string;
          stage?: string | null;
          progress_details?: JobProgressDetails | null;
          payload: CreateJobPayload;
          result_dossier_id?: string | null;
          error_message?: string | null;
          retry_count?: number;
          max_retries?: number;
          locked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          status?: string;
          stage?: string | null;
          progress_details?: JobProgressDetails | null;
          payload?: CreateJobPayload;
          result_dossier_id?: string | null;
          error_message?: string | null;
          retry_count?: number;
          max_retries?: number;
          locked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string | null;
          document_id: string;
          sequence_number: number;
          action: AuditAction;
          timestamp: string;
          actor: string;
          actor_id: string | null;
          previous_hash: string;
          current_hash: string;
          details: AuditLogDetails;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          document_id: string;
          sequence_number?: number;
          action: AuditAction;
          timestamp?: string;
          actor: string;
          previous_hash?: string;
          current_hash?: string;
          details?: AuditLogDetails;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          document_id?: string;
          sequence_number?: number;
          action?: AuditAction;
          timestamp?: string;
          actor?: string;
          previous_hash?: string;
          current_hash?: string;
          details?: AuditLogDetails;
        };
        Relationships: [];
      };
      knowledge_documents: {
        Row: {
          id: string;
          organization_id: string | null;
          category: string;
          legal_basis: string;
          court_or_authority: string | null;
          title: string;
          content: string;
          trigger_keywords: string[];
          embedding: number[] | null;
          tsv: string | null;
          source_reference: string | null;
          valid_from: string | null;
          valid_until: string | null;
          version: number;
          review_status: string;
          retention_years: number | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          category: string;
          legal_basis: string;
          court_or_authority?: string | null;
          title: string;
          content: string;
          trigger_keywords?: string[];
          embedding?: number[] | null;
          tsv?: string | null;
          source_reference?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          version?: number;
          review_status?: string;
          retention_years?: number | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          category?: string;
          legal_basis?: string;
          court_or_authority?: string | null;
          title?: string;
          content?: string;
          trigger_keywords?: string[];
          embedding?: number[] | null;
          tsv?: string | null;
          source_reference?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          version?: number;
          review_status?: string;
          retention_years?: number | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workflow_definitions: {
        Row: {
          id: string;
          version: number;
          case_type: string;
          title: string;
          organization_id: string | null;
          steps: WorkflowStepDefinition[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          version?: number;
          case_type: string;
          title: string;
          organization_id?: string | null;
          steps?: WorkflowStepDefinition[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          version?: number;
          case_type?: string;
          title?: string;
          organization_id?: string | null;
          steps?: WorkflowStepDefinition[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workflow_instances: {
        Row: {
          id: string;
          workflow_definition_id: string;
          case_id: string;
          organization_id: string;
          current_step_id: string | null;
          status: string;
          step_states: Record<string, StepState>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workflow_definition_id: string;
          case_id: string;
          organization_id: string;
          current_step_id?: string | null;
          status?: string;
          step_states?: Record<string, StepState>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workflow_definition_id?: string;
          case_id?: string;
          organization_id?: string;
          current_step_id?: string | null;
          status?: string;
          step_states?: Record<string, StepState>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      deletion_tasks: {
        Row: {
          id: string;
          organization_id: string;
          document_id: string;
          storage_path: string;
          status: DeletionTaskStatus;
          attempts: number;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          document_id: string;
          storage_path: string;
          status?: DeletionTaskStatus;
          attempts?: number;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: DeletionTaskStatus;
          attempts?: number;
          last_error?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      llm_usage: {
        Row: {
          id: string;
          organization_id: string;
          job_id: string | null;
          stage: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          job_id?: string | null;
          stage: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      audit_actor_map: {
        Row: {
          document_id: string;
          user_id: string;
          organization_id: string;
          actor_ref: string;
          display_name: string;
        };
        Insert: {
          document_id: string;
          user_id: string;
          organization_id: string;
          actor_ref?: string;
          display_name: string;
        };
        Update: {
          display_name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_new_organization: {
        Args: {
          org_name: string;
          org_seat: string;
          org_chamber: string;
        };
        Returns: Database['public']['Tables']['organizations']['Row'];
      };
      create_organization_with_owner: {
        Args: {
          p_org_name: string;
          p_official_seat: string;
          p_chamber_district: string;
        };
        Returns: Database['public']['Tables']['organizations']['Row'];
      };
      delete_dossier: {
        Args: { p_document_id: string; p_reason: string };
        Returns: Json;
      };
      delete_dossier_system: {
        Args: { p_document_id: string };
        Returns: Json;
      };
      list_retention_expired_dossiers: {
        Args: { p_limit: number };
        Returns: { id: string; organization_id: string }[];
      };
      complete_dossier_purge: {
        Args: { p_document_id: string };
        Returns: boolean;
      };
      verify_audit_chain: {
        Args: { p_document_id: string };
        Returns: Json;
      };
      match_knowledge_documents: {
        Args: {
          p_query_text: string;
          p_query_embedding?: number[] | null;
          p_organization_id?: string | null;
          p_category?: string | null;
          p_match_count?: number;
          p_vector_weight?: number;
        };
        Returns: Array<{
          id: string;
          organization_id: string | null;
          category: string;
          legal_basis: string;
          court_or_authority: string | null;
          title: string;
          content: string;
          trigger_keywords: string[];
          bm25_score: number;
          vector_score: number;
          combined_score: number;
          match_source: string;
          created_at: string;
          updated_at: string;
        }>;
      };
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T];
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
