export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      archive_items: {
        Row: {
          audio_url: string | null
          created_at: string | null
          difficulty: string | null
          discourse_genre: string | null
          id: string
          is_learning_pick: boolean | null
          item_type: string | null
          mode: string
          researcher_notes: string | null
          sector: string | null
          source_origin: string | null
          source_text: string | null
          speech_act: string | null
          status: string | null
          title: string
          title_auto_generated: boolean | null
          topic: string | null
          updated_at: string | null
          youtube_id: string | null
          youtube_url: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          difficulty?: string | null
          discourse_genre?: string | null
          id?: string
          is_learning_pick?: boolean | null
          item_type?: string | null
          mode: string
          researcher_notes?: string | null
          sector?: string | null
          source_origin?: string | null
          source_text?: string | null
          speech_act?: string | null
          status?: string | null
          title: string
          title_auto_generated?: boolean | null
          topic?: string | null
          updated_at?: string | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          difficulty?: string | null
          discourse_genre?: string | null
          id?: string
          is_learning_pick?: boolean | null
          item_type?: string | null
          mode?: string
          researcher_notes?: string | null
          sector?: string | null
          source_origin?: string | null
          source_text?: string | null
          speech_act?: string | null
          status?: string | null
          title?: string
          title_auto_generated?: boolean | null
          topic?: string | null
          updated_at?: string | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      assessment_form_items: {
        Row: {
          created_at: string
          form_id: string
          id: string
          position: number
          scenario_id: string
        }
        Insert: {
          created_at?: string
          form_id: string
          id?: string
          position?: number
          scenario_id: string
        }
        Update: {
          created_at?: string
          form_id?: string
          id?: string
          position?: number
          scenario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_form_items_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "assessment_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_form_items_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      assessment_forms: {
        Row: {
          cohort_id: string | null
          created_at: string
          form_id: string
          form_ver: string
          id: string
          measurement_point: string
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string
          form_id: string
          form_ver?: string
          id?: string
          measurement_point: string
        }
        Update: {
          cohort_id?: string | null
          created_at?: string
          form_id?: string
          form_ver?: string
          id?: string
          measurement_point?: string
        }
        Relationships: []
      }
      course_week_package_assignments: {
        Row: {
          course_week: number
          created_at: string
          id: string
          package_id: string
          sequence: number
        }
        Insert: {
          course_week: number
          created_at?: string
          id?: string
          package_id: string
          sequence?: number
        }
        Update: {
          course_week?: number
          created_at?: string
          id?: string
          package_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_week_package_assignments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "feature_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      course_weeks: {
        Row: {
          course_phase: string
          created_at: string
          detail_topic: string
          display_order: number
          id: string
          is_exam_week: boolean
          is_onboarding_week: boolean
          lecture_topic: string | null
          updated_at: string
          week_no: number
        }
        Insert: {
          course_phase: string
          created_at?: string
          detail_topic: string
          display_order: number
          id?: string
          is_exam_week?: boolean
          is_onboarding_week?: boolean
          lecture_topic?: string | null
          updated_at?: string
          week_no: number
        }
        Update: {
          course_phase?: string
          created_at?: string
          detail_topic?: string
          display_order?: number
          id?: string
          is_exam_week?: boolean
          is_onboarding_week?: boolean
          lecture_topic?: string | null
          updated_at?: string
          week_no?: number
        }
        Relationships: []
      }
      curriculum_outlines: {
        Row: {
          composition_theme_codes: string[]
          course_mode: string
          created_at: string
          domain: string
          final_week: number | null
          id: string
          industry: string | null
          language_direction: string
          level: string
          midterm_week: number | null
          scenarios_per_week: number
          semester_goal: string | null
          status: string
          target_speech_acts: string[]
          target_interpreting_ratio: number
          target_interpreting_week_count: number
          title: string
          updated_at: string
          week_count: number
        }
        Insert: {
          composition_theme_codes?: string[]
          course_mode?: string
          created_at?: string
          domain: string
          final_week?: number | null
          id?: string
          industry?: string | null
          language_direction: string
          level: string
          midterm_week?: number | null
          scenarios_per_week?: number
          semester_goal?: string | null
          status?: string
          target_speech_acts?: string[]
          target_interpreting_ratio?: number
          target_interpreting_week_count?: number
          title: string
          updated_at?: string
          week_count?: number
        }
        Update: {
          composition_theme_codes?: string[]
          course_mode?: string
          created_at?: string
          domain?: string
          final_week?: number | null
          id?: string
          industry?: string | null
          language_direction?: string
          level?: string
          midterm_week?: number | null
          scenarios_per_week?: number
          semester_goal?: string | null
          status?: string
          target_speech_acts?: string[]
          target_interpreting_ratio?: number
          target_interpreting_week_count?: number
          title?: string
          updated_at?: string
          week_count?: number
        }
        Relationships: []
      }
      curriculum_week_scenarios: {
        Row: {
          changed_context_axes: string[]
          created_at: string
          diagnostic_dimensions: string[]
          id: string
          mission_role: string | null
          outline_id: string
          pair_contract_version: string | null
          position: number
          scenario_id: string
          slot_role: string
          updated_at: string
          week_no: number
        }
        Insert: {
          changed_context_axes?: string[]
          created_at?: string
          diagnostic_dimensions?: string[]
          id?: string
          mission_role?: string | null
          outline_id: string
          pair_contract_version?: string | null
          position?: number
          scenario_id: string
          slot_role?: string
          updated_at?: string
          week_no: number
        }
        Update: {
          changed_context_axes?: string[]
          created_at?: string
          diagnostic_dimensions?: string[]
          id?: string
          mission_role?: string | null
          outline_id?: string
          pair_contract_version?: string | null
          position?: number
          scenario_id?: string
          slot_role?: string
          updated_at?: string
          week_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_week_scenarios_outline_fkey"
            columns: ["outline_id"]
            isOneToOne: false
            referencedRelation: "curriculum_outlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_week_scenarios_scenario_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      curriculum_weeks: {
        Row: {
          can_do: string[] | null
          channel: string | null
          competency_focus: string | null
          created_at: string
          curriculum_load_band: number | null
          domain: string | null
          id: string
          industry: string | null
          outline_id: string
          pdr_distance: string | null
          pdr_imposition: string | null
          pdr_power: string | null
          review_released: boolean
          scenario_slots: number | null
          speech_act: string | null
          title: string | null
          type: string
          updated_at: string
          week_no: number
        }
        Insert: {
          can_do?: string[] | null
          channel?: string | null
          competency_focus?: string | null
          created_at?: string
          curriculum_load_band?: number | null
          domain?: string | null
          id?: string
          industry?: string | null
          outline_id: string
          pdr_distance?: string | null
          pdr_imposition?: string | null
          pdr_power?: string | null
          review_released?: boolean
          scenario_slots?: number | null
          speech_act?: string | null
          title?: string | null
          type?: string
          updated_at?: string
          week_no: number
        }
        Update: {
          can_do?: string[] | null
          channel?: string | null
          competency_focus?: string | null
          created_at?: string
          curriculum_load_band?: number | null
          domain?: string | null
          id?: string
          industry?: string | null
          outline_id?: string
          pdr_distance?: string | null
          pdr_imposition?: string | null
          pdr_power?: string | null
          review_released?: boolean
          scenario_slots?: number | null
          speech_act?: string | null
          title?: string | null
          type?: string
          updated_at?: string
          week_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_weeks_outline_id_fkey"
            columns: ["outline_id"]
            isOneToOne: false
            referencedRelation: "curriculum_outlines"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_traces: {
        Row: {
          auth_user_id: string
          best_choice_reason: string | null
          choice_reason_legacy: string | null
          created_at: string
          decision_trace_complete: boolean | null
          feedback_decisions: Json | null
          feedback_legacy: Json | null
          final_justification: string | null
          final_translation: string | null
          genre: string | null
          id: string
          language_direction: string | null
          option_display_mapping: Json | null
          pdr_response: Json | null
          profile_id: string
          scenario_id: string | null
          scenario_key: string
          selected_best_option_id: string | null
          selected_worst_option_id: string | null
          session_id: string | null
          speech_act: string
          student_proposal_reason_pre_feedback: string | null
          student_proposed_translation_pre_feedback: string | null
          submitted_at: string | null
          task_mode: string | null
          updated_at: string
          worst_choice_reason: string | null
        }
        Insert: {
          auth_user_id: string
          best_choice_reason?: string | null
          choice_reason_legacy?: string | null
          created_at?: string
          decision_trace_complete?: boolean | null
          feedback_decisions?: Json | null
          feedback_legacy?: Json | null
          final_justification?: string | null
          final_translation?: string | null
          genre?: string | null
          id?: string
          language_direction?: string | null
          option_display_mapping?: Json | null
          pdr_response?: Json | null
          profile_id: string
          scenario_id?: string | null
          scenario_key: string
          selected_best_option_id?: string | null
          selected_worst_option_id?: string | null
          session_id?: string | null
          speech_act: string
          student_proposal_reason_pre_feedback?: string | null
          student_proposed_translation_pre_feedback?: string | null
          submitted_at?: string | null
          task_mode?: string | null
          updated_at?: string
          worst_choice_reason?: string | null
        }
        Update: {
          auth_user_id?: string
          best_choice_reason?: string | null
          choice_reason_legacy?: string | null
          created_at?: string
          decision_trace_complete?: boolean | null
          feedback_decisions?: Json | null
          feedback_legacy?: Json | null
          final_justification?: string | null
          final_translation?: string | null
          genre?: string | null
          id?: string
          language_direction?: string | null
          option_display_mapping?: Json | null
          pdr_response?: Json | null
          profile_id?: string
          scenario_id?: string | null
          scenario_key?: string
          selected_best_option_id?: string | null
          selected_worst_option_id?: string | null
          session_id?: string | null
          speech_act?: string
          student_proposal_reason_pre_feedback?: string | null
          student_proposed_translation_pre_feedback?: string | null
          submitted_at?: string | null
          task_mode?: string | null
          updated_at?: string
          worst_choice_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_traces_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_packages: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          generation_model: string | null
          generation_prompt_ver: string | null
          id: string
          intro_hook: Json | null
          mpj_items: Json | null
          mpj_labels: Json | null
          package_ver: string
          ref_cases: Json | null
          review_warnings: Json | null
          reviewer_model: string | null
          reviewer_prompt_ver: string | null
          rule_check_result: Json | null
          speech_act: Database["public"]["Enums"]["speech_act"]
          status: Database["public"]["Enums"]["review_status"]
          target_feature: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          generation_model?: string | null
          generation_prompt_ver?: string | null
          id?: string
          intro_hook?: Json | null
          mpj_items?: Json | null
          mpj_labels?: Json | null
          package_ver?: string
          ref_cases?: Json | null
          review_warnings?: Json | null
          reviewer_model?: string | null
          reviewer_prompt_ver?: string | null
          rule_check_result?: Json | null
          speech_act: Database["public"]["Enums"]["speech_act"]
          status?: Database["public"]["Enums"]["review_status"]
          target_feature: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          generation_model?: string | null
          generation_prompt_ver?: string | null
          id?: string
          intro_hook?: Json | null
          mpj_items?: Json | null
          mpj_labels?: Json | null
          package_ver?: string
          ref_cases?: Json | null
          review_warnings?: Json | null
          reviewer_model?: string | null
          reviewer_prompt_ver?: string | null
          rule_check_result?: Json | null
          speech_act?: Database["public"]["Enums"]["speech_act"]
          status?: Database["public"]["Enums"]["review_status"]
          target_feature?: string
          updated_at?: string
        }
        Relationships: []
      }
      hsk_reference_sources: {
        Row: {
          created_at: string
          effective_at: string | null
          extraction_version: string
          id: string
          manifest_version: string
          notes: string | null
          official_url: string
          publisher: string
          released_at: string | null
          sha256: string
          title: string
        }
        Insert: {
          created_at?: string
          effective_at?: string | null
          extraction_version: string
          id: string
          manifest_version: string
          notes?: string | null
          official_url: string
          publisher: string
          released_at?: string | null
          sha256: string
          title: string
        }
        Update: {
          created_at?: string
          effective_at?: string | null
          extraction_version?: string
          id?: string
          manifest_version?: string
          notes?: string | null
          official_url?: string
          publisher?: string
          released_at?: string | null
          sha256?: string
          title?: string
        }
        Relationships: []
      }
      hsk3_topic_derivations: {
        Row: {
          appears_in_levels: number[]
          created_at: string
          derivation_version: string
          has_explicit_open_marker: boolean
          l3_terms: string[]
          n_levels: number
          n_terms: number
          path: string
          source_id: string
          topic_seq: number
        }
        Insert: {
          appears_in_levels: number[]
          created_at?: string
          derivation_version: string
          has_explicit_open_marker: boolean
          l3_terms: string[]
          n_levels: number
          n_terms: number
          path: string
          source_id: string
          topic_seq: number
        }
        Update: {
          appears_in_levels?: number[]
          created_at?: string
          derivation_version?: string
          has_explicit_open_marker?: boolean
          l3_terms?: string[]
          n_levels?: number
          n_terms?: number
          path?: string
          source_id?: string
          topic_seq?: number
        }
        Relationships: []
      }
      hsk3_topics: {
        Row: {
          l1: string
          l2: string
          l3: string
          level_band: string
          level_int: number
          source_id: string
          topic_seq: number
        }
        Insert: {
          l1: string
          l2: string
          l3: string
          level_band: string
          level_int: number
          source_id: string
          topic_seq: number
        }
        Update: {
          l1?: string
          l2?: string
          l3?: string
          level_band?: string
          level_int?: number
          source_id?: string
          topic_seq?: number
        }
        Relationships: []
      }
      hsk3_vocab: {
        Row: {
          extra_levels: number[]
          headword: string
          intro_band: string
          intro_level: number
          is_multi_sense: boolean
          is_phrase: boolean
          is_polyphone: boolean
          pinyin: string
          pinyin_norm: string
          pos: string | null
          sense_no: number
          seq: number
          source_form: string
          source_id: string
          source_note: string | null
        }
        Insert: {
          extra_levels?: number[]
          headword: string
          intro_band: string
          intro_level: number
          is_multi_sense?: boolean
          is_phrase?: boolean
          is_polyphone?: boolean
          pinyin: string
          pinyin_norm: string
          pos?: string | null
          sense_no?: number
          seq: number
          source_form: string
          source_id: string
          source_note?: string | null
        }
        Update: {
          extra_levels?: number[]
          headword?: string
          intro_band?: string
          intro_level?: number
          is_multi_sense?: boolean
          is_phrase?: boolean
          is_polyphone?: boolean
          pinyin?: string
          pinyin_norm?: string
          pos?: string | null
          sense_no?: number
          seq?: number
          source_form?: string
          source_id?: string
          source_note?: string | null
        }
        Relationships: []
      }
      pragma_hsk_topic_mappings: {
        Row: {
          app_domain_code: string | null
          axis_code: string
          coded_at: string | null
          coded_by: string | null
          coding_status: string
          created_at: string
          exclusion_reason_code: string | null
          has_state_administration_frame: boolean
          mapping_version: string
          notes: string | null
          scope_code: string
          selection_status: string
          source_id: string
          topic_seq: number
          updated_at: string
        }
        Insert: {
          app_domain_code?: string | null
          axis_code: string
          coded_at?: string | null
          coded_by?: string | null
          coding_status: string
          created_at?: string
          exclusion_reason_code?: string | null
          has_state_administration_frame?: boolean
          mapping_version: string
          notes?: string | null
          scope_code: string
          selection_status?: string
          source_id: string
          topic_seq: number
          updated_at?: string
        }
        Update: {
          app_domain_code?: string | null
          axis_code?: string
          coded_at?: string | null
          coded_by?: string | null
          coding_status?: string
          created_at?: string
          exclusion_reason_code?: string | null
          has_state_administration_frame?: boolean
          mapping_version?: string
          notes?: string | null
          scope_code?: string
          selection_status?: string
          source_id?: string
          topic_seq?: number
          updated_at?: string
        }
        Relationships: []
      }
      hsk_vocab: {
        Row: {
          created_at: string
          hsk_level: number
          id: string
          pinyin: string | null
          pos: string | null
          source: string | null
          word: string
        }
        Insert: {
          created_at?: string
          hsk_level: number
          id?: string
          pinyin?: string | null
          pos?: string | null
          source?: string | null
          word: string
        }
        Update: {
          created_at?: string
          hsk_level?: number
          id?: string
          pinyin?: string | null
          pos?: string | null
          source?: string | null
          word?: string
        }
        Relationships: []
      }
      learner_mission_logs: {
        Row: {
          assignment_id: string | null
          attempt_id: string | null
          auth_user_id: string
          cell_id: string | null
          cohort_id: string | null
          completed_at: string | null
          consent_version: string | null
          content_ver: string | null
          content_hash: string | null
          course_id: string | null
          context_judgment: Json | null
          created_at: string
          example_shown: boolean | null
          feature_id: string | null
          first_response: string | null
          form_id: string | null
          form_order: string | null
          hint_used: boolean | null
          id: string
          level: string | null
          measurement_point: string | null
          mission_completed: boolean | null
          mission_id: string
          mode: string
          package_id: string | null
          policy_ver: string | null
          profile_id: string
          revised_response: string | null
          revision_target_selected: string | null
          revision_target_source: string | null
          self_confidence_rating: number | null
          semantic_fidelity_status: string | null
          source_lang: string | null
          source_text: string | null
          speech_act: string | null
          started_at: string | null
          study_id: string | null
          target_feature_observed: Json | null
          target_lang: string | null
          task_type: string | null
          transfer_response: string | null
          updated_at: string
          week_no: number | null
        }
        Insert: {
          assignment_id?: string | null
          attempt_id?: string | null
          auth_user_id: string
          cell_id?: string | null
          cohort_id?: string | null
          completed_at?: string | null
          consent_version?: string | null
          content_ver?: string | null
          content_hash?: string | null
          course_id?: string | null
          context_judgment?: Json | null
          created_at?: string
          example_shown?: boolean | null
          feature_id?: string | null
          first_response?: string | null
          form_id?: string | null
          form_order?: string | null
          hint_used?: boolean | null
          id?: string
          level?: string | null
          measurement_point?: string | null
          mission_completed?: boolean | null
          mission_id: string
          mode: string
          package_id?: string | null
          policy_ver?: string | null
          profile_id: string
          revised_response?: string | null
          revision_target_selected?: string | null
          revision_target_source?: string | null
          self_confidence_rating?: number | null
          semantic_fidelity_status?: string | null
          source_lang?: string | null
          source_text?: string | null
          speech_act?: string | null
          started_at?: string | null
          study_id?: string | null
          target_feature_observed?: Json | null
          target_lang?: string | null
          task_type?: string | null
          transfer_response?: string | null
          updated_at?: string
          week_no?: number | null
        }
        Update: {
          assignment_id?: string | null
          attempt_id?: string | null
          auth_user_id?: string
          cell_id?: string | null
          cohort_id?: string | null
          completed_at?: string | null
          consent_version?: string | null
          content_ver?: string | null
          content_hash?: string | null
          course_id?: string | null
          context_judgment?: Json | null
          created_at?: string
          example_shown?: boolean | null
          feature_id?: string | null
          first_response?: string | null
          form_id?: string | null
          form_order?: string | null
          hint_used?: boolean | null
          id?: string
          level?: string | null
          measurement_point?: string | null
          mission_completed?: boolean | null
          mission_id?: string
          mode?: string
          package_id?: string | null
          policy_ver?: string | null
          profile_id?: string
          revised_response?: string | null
          revision_target_selected?: string | null
          revision_target_source?: string | null
          self_confidence_rating?: number | null
          semantic_fidelity_status?: string | null
          source_lang?: string | null
          source_text?: string | null
          speech_act?: string | null
          started_at?: string | null
          study_id?: string | null
          target_feature_observed?: Json | null
          target_lang?: string | null
          task_type?: string | null
          transfer_response?: string | null
          updated_at?: string
          week_no?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "learner_mission_logs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "curriculum_week_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_mission_logs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "curriculum_outlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_mission_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_invocation_events: {
        Row: {
          cached_tokens: number | null
          completion_tokens: number | null
          content_release_id: string | null
          created_at: string
          duration_ms: number
          fallback_from: string | null
          finish_reason: string | null
          generation_item_key: string | null
          generation_run_id: string | null
          id: string
          invocation_attempt: number
          is_model_fallback: boolean
          model_requested: string
          model_returned: string | null
          operation: string
          prompt_snapshot_hash: string | null
          prompt_tokens: number | null
          prompt_version: string | null
          provider: string
          provider_request_id: string | null
          provider_response_id: string | null
          reasoning_tokens: number | null
          request_group_id: string
          scenario_id: string | null
          status_code: number
          success: boolean
          total_tokens: number | null
        }
        Insert: {
          cached_tokens?: number | null
          completion_tokens?: number | null
          content_release_id?: string | null
          created_at?: string
          duration_ms: number
          fallback_from?: string | null
          finish_reason?: string | null
          generation_item_key?: string | null
          generation_run_id?: string | null
          id?: string
          invocation_attempt?: number
          is_model_fallback?: boolean
          model_requested: string
          model_returned?: string | null
          operation: string
          prompt_snapshot_hash?: string | null
          prompt_tokens?: number | null
          prompt_version?: string | null
          provider: string
          provider_request_id?: string | null
          provider_response_id?: string | null
          reasoning_tokens?: number | null
          request_group_id: string
          scenario_id?: string | null
          status_code: number
          success: boolean
          total_tokens?: number | null
        }
        Update: {
          cached_tokens?: number | null
          completion_tokens?: number | null
          content_release_id?: string | null
          created_at?: string
          duration_ms?: number
          fallback_from?: string | null
          finish_reason?: string | null
          generation_item_key?: string | null
          generation_run_id?: string | null
          id?: string
          invocation_attempt?: number
          is_model_fallback?: boolean
          model_requested?: string
          model_returned?: string | null
          operation?: string
          prompt_snapshot_hash?: string | null
          prompt_tokens?: number | null
          prompt_version?: string | null
          provider?: string
          provider_request_id?: string | null
          provider_response_id?: string | null
          reasoning_tokens?: number | null
          request_group_id?: string
          scenario_id?: string | null
          status_code?: number
          success?: boolean
          total_tokens?: number | null
        }
        Relationships: []
      }
      package_items: {
        Row: {
          activity_type: string | null
          changed_axis: string | null
          created_at: string
          id: string
          package_id: string
          pair_id: string | null
          pair_role: string | null
          position: number
          scenario_id: string
          slot: string
          task_type: string | null
        }
        Insert: {
          activity_type?: string | null
          changed_axis?: string | null
          created_at?: string
          id?: string
          package_id: string
          pair_id?: string | null
          pair_role?: string | null
          position?: number
          scenario_id: string
          slot: string
          task_type?: string | null
        }
        Update: {
          activity_type?: string | null
          changed_axis?: string | null
          created_at?: string
          id?: string
          package_id?: string
          pair_id?: string | null
          pair_role?: string | null
          position?: number
          scenario_id?: string
          slot?: string
          task_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "feature_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_items_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      package_level_variants: {
        Row: {
          created_at: string
          id: string
          level: string
          level_text_variant: Json | null
          package_id: string
          policy_override: Json | null
          updated_at: string
          validation_status: Database["public"]["Enums"]["auto_check_result"]
          variant_status: string
        }
        Insert: {
          created_at?: string
          id?: string
          level: string
          level_text_variant?: Json | null
          package_id: string
          policy_override?: Json | null
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["auto_check_result"]
          variant_status?: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          level_text_variant?: Json | null
          package_id?: string
          policy_override?: Json | null
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["auto_check_result"]
          variant_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_level_variants_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "feature_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academic_year_or_program: string | null
          affiliation: string | null
          affiliation_or_status: string | null
          ai_prompting_style_for_ti: string | null
          anonymization_notice_confirmed: boolean
          anonymous_participant_id: string | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          business_chinese_experience: string | null
          chinese_exposure_contexts: string[] | null
          chinese_level: string | null
          chinese_proficiency_self_report: string | null
          consent_anonymous_analysis: boolean
          consent_class_record_sharing: boolean | null
          consent_data_use: boolean
          consent_email_report: boolean
          created_at: string
          email: string | null
          full_name: string | null
          genai_use_frequency: string | null
          grade_or_program: string | null
          id: string
          interpreting_experience: string | null
          language_background: string | null
          name: string | null
          perceived_ai_ti_difficulty: string | null
          perceived_business_chinese_ti_risk: string | null
          profile_completed: boolean
          report_email_consent: boolean | null
          research_use_consent: boolean
          role: Database["public"]["Enums"]["app_role"]
          ti_experience_level: string | null
          ti_experience_modes: string[] | null
          ti_experience_note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year_or_program?: string | null
          affiliation?: string | null
          affiliation_or_status?: string | null
          ai_prompting_style_for_ti?: string | null
          anonymization_notice_confirmed?: boolean
          anonymous_participant_id?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          business_chinese_experience?: string | null
          chinese_exposure_contexts?: string[] | null
          chinese_level?: string | null
          chinese_proficiency_self_report?: string | null
          consent_anonymous_analysis?: boolean
          consent_class_record_sharing?: boolean | null
          consent_data_use?: boolean
          consent_email_report?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          genai_use_frequency?: string | null
          grade_or_program?: string | null
          id?: string
          interpreting_experience?: string | null
          language_background?: string | null
          name?: string | null
          perceived_ai_ti_difficulty?: string | null
          perceived_business_chinese_ti_risk?: string | null
          profile_completed?: boolean
          report_email_consent?: boolean | null
          research_use_consent?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          ti_experience_level?: string | null
          ti_experience_modes?: string[] | null
          ti_experience_note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year_or_program?: string | null
          affiliation?: string | null
          affiliation_or_status?: string | null
          ai_prompting_style_for_ti?: string | null
          anonymization_notice_confirmed?: boolean
          anonymous_participant_id?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          business_chinese_experience?: string | null
          chinese_exposure_contexts?: string[] | null
          chinese_level?: string | null
          chinese_proficiency_self_report?: string | null
          consent_anonymous_analysis?: boolean
          consent_class_record_sharing?: boolean | null
          consent_data_use?: boolean
          consent_email_report?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          genai_use_frequency?: string | null
          grade_or_program?: string | null
          id?: string
          interpreting_experience?: string | null
          language_background?: string | null
          name?: string | null
          perceived_ai_ti_difficulty?: string | null
          perceived_business_chinese_ti_risk?: string | null
          profile_completed?: boolean
          report_email_consent?: boolean | null
          research_use_consent?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          ti_experience_level?: string | null
          ti_experience_modes?: string[] | null
          ti_experience_note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompt_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          prompt_key: string
          title: string | null
          updated_at: string
          version: number
        }
        Insert: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          prompt_key: string
          title?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          prompt_key?: string
          title?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      scenario_candidates: {
        Row: {
          appropriateness_label: string | null
          candidate_text: string | null
          created_at: string
          directness_level: number | null
          display_order: number | null
          failed_challenge: string[] | null
          id: string
          rationale: string | null
          scenario_id: string
        }
        Insert: {
          appropriateness_label?: string | null
          candidate_text?: string | null
          created_at?: string
          directness_level?: number | null
          display_order?: number | null
          failed_challenge?: string[] | null
          id?: string
          rationale?: string | null
          scenario_id: string
        }
        Update: {
          appropriateness_label?: string | null
          candidate_text?: string | null
          created_at?: string
          directness_level?: number | null
          display_order?: number | null
          failed_challenge?: string[] | null
          id?: string
          rationale?: string | null
          scenario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_candidates_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      scenario_feedback: {
        Row: {
          created_at: string | null
          feedback_id: string
          field_expert_perspective: string | null
          recipient_perspective: string | null
          scenario_id: string | null
          teacher_perspective: string | null
        }
        Insert: {
          created_at?: string | null
          feedback_id?: string
          field_expert_perspective?: string | null
          recipient_perspective?: string | null
          scenario_id?: string | null
          teacher_perspective?: string | null
        }
        Update: {
          created_at?: string | null
          feedback_id?: string
          field_expert_perspective?: string | null
          recipient_perspective?: string | null
          scenario_id?: string | null
          teacher_perspective?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scenario_feedback_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      scenarios: {
        Row: {
          approval_basis: string | null
          archive_note: string | null
          archived_at: string | null
          auto_check_result:
            | Database["public"]["Enums"]["auto_check_result"]
            | null
          business_function: string | null
          challenge_intensity: string | null
          content_format: string
          content_hash: string | null
          core_content: Json | null
          created_at: string | null
          domain: string | null
          generation_item_key: string | null
          generation_prompt_version: string | null
          generation_provider: string | null
          generation_run_id: string | null
          generator_model: string | null
          genre: string | null
          hsk_level_min: number | null
          industry_sector: string | null
          interaction_context: string | null
          language_direction: string | null
          learner_level: string | null
          mission_content: Json | null
          mission_reviewed_at: string | null
          mission_reviewed_by: string | null
          mission_status: string | null
          mode: string | null
          pragmatic_challenge: string[] | null
          prompt_snapshot_hash: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          scenario_d: string | null
          scenario_id: string
          scenario_p: string | null
          scenario_r: string | null
          source_modality: string | null
          source_text: string | null
          speech_act: Database["public"]["Enums"]["speech_act"]
          speech_act_text: string | null
          supersedes_scenario_id: string | null
          target_feature: string | null
          target_feature_version: string | null
          theme_code: string | null
          title: string
          topic: string | null
          topic_code: string | null
          updated_at: string | null
          usage_assignment: Database["public"]["Enums"]["usage_assignment"]
          week_no: number | null
        }
        Insert: {
          approval_basis?: string | null
          archive_note?: string | null
          archived_at?: string | null
          auto_check_result?:
            | Database["public"]["Enums"]["auto_check_result"]
            | null
          business_function?: string | null
          challenge_intensity?: string | null
          content_format?: string
          content_hash?: string | null
          core_content?: Json | null
          created_at?: string | null
          domain?: string | null
          generation_item_key?: string | null
          generation_prompt_version?: string | null
          generation_provider?: string | null
          generation_run_id?: string | null
          generator_model?: string | null
          genre?: string | null
          hsk_level_min?: number | null
          industry_sector?: string | null
          interaction_context?: string | null
          language_direction?: string | null
          learner_level?: string | null
          mission_content?: Json | null
          mission_reviewed_at?: string | null
          mission_reviewed_by?: string | null
          mission_status?: string | null
          mode?: string | null
          pragmatic_challenge?: string[] | null
          prompt_snapshot_hash?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          scenario_d?: string | null
          scenario_id?: string
          scenario_p?: string | null
          scenario_r?: string | null
          source_modality?: string | null
          source_text?: string | null
          speech_act: Database["public"]["Enums"]["speech_act"]
          speech_act_text?: string | null
          supersedes_scenario_id?: string | null
          target_feature?: string | null
          target_feature_version?: string | null
          theme_code?: string | null
          title: string
          topic?: string | null
          topic_code?: string | null
          updated_at?: string | null
          usage_assignment?: Database["public"]["Enums"]["usage_assignment"]
          week_no?: number | null
        }
        Update: {
          approval_basis?: string | null
          archive_note?: string | null
          archived_at?: string | null
          auto_check_result?:
            | Database["public"]["Enums"]["auto_check_result"]
            | null
          business_function?: string | null
          challenge_intensity?: string | null
          content_format?: string
          content_hash?: string | null
          core_content?: Json | null
          created_at?: string | null
          domain?: string | null
          generation_item_key?: string | null
          generation_prompt_version?: string | null
          generation_provider?: string | null
          generation_run_id?: string | null
          generator_model?: string | null
          genre?: string | null
          hsk_level_min?: number | null
          industry_sector?: string | null
          interaction_context?: string | null
          language_direction?: string | null
          learner_level?: string | null
          mission_content?: Json | null
          mission_reviewed_at?: string | null
          mission_reviewed_by?: string | null
          mission_status?: string | null
          mode?: string | null
          pragmatic_challenge?: string[] | null
          prompt_snapshot_hash?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          scenario_d?: string | null
          scenario_id?: string
          scenario_p?: string | null
          scenario_r?: string | null
          source_modality?: string | null
          source_text?: string | null
          speech_act?: Database["public"]["Enums"]["speech_act"]
          speech_act_text?: string | null
          supersedes_scenario_id?: string | null
          target_feature?: string | null
          target_feature_version?: string | null
          theme_code?: string | null
          title?: string
          topic?: string | null
          topic_code?: string | null
          updated_at?: string | null
          usage_assignment?: Database["public"]["Enums"]["usage_assignment"]
          week_no?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_supersedes_scenario_id_fkey"
            columns: ["supersedes_scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      youtube_sources: {
        Row: {
          available_langs: string[] | null
          created_at: string
          created_by: string | null
          extract_status: string | null
          id: string
          lang: string | null
          transcript: string | null
          url: string
          video_title: string | null
        }
        Insert: {
          available_langs?: string[] | null
          created_at?: string
          created_by?: string | null
          extract_status?: string | null
          id?: string
          lang?: string | null
          transcript?: string | null
          url: string
          video_title?: string | null
        }
        Update: {
          available_langs?: string[] | null
          created_at?: string
          created_by?: string | null
          extract_status?: string | null
          id?: string
          lang?: string | null
          transcript?: string | null
          url?: string
          video_title?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      hsk3_reference_status: {
        Row: {
          derived_topic_rows: number | null
          effective_at: string | null
          extraction_version: string | null
          manifest_version: string | null
          official_topic_rows: number | null
          official_url: string | null
          publisher: string | null
          released_at: string | null
          researcher_mapping_rows: number | null
          sha256: string | null
          source_id: string | null
          title: string | null
          vocabulary_entries: number | null
        }
        Relationships: []
      }
      hsk3_vocab_cumulative: {
        Row: {
          extra_levels: number[] | null
          headword: string | null
          intro_band: string | null
          intro_level: number | null
          is_multi_sense: boolean | null
          is_phrase: boolean | null
          is_polyphone: boolean | null
          pinyin: string | null
          pinyin_norm: string | null
          pos: string | null
          reference_ceiling: number | null
          sense_no: number | null
          seq: number | null
          source_form: string | null
          source_id: string | null
          source_note: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ensure_test_dev_profile: { Args: never; Returns: undefined }
      has_completed_learner_profile: { Args: never; Returns: boolean }
      hsk3_match_tokens: {
        Args: {
          p_max_intro_level: number
          p_source_id: string
          p_tokens: string[]
        }
        Returns: {
          headword: string
          intro_level: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      review_mission: { Args: { p_scenario_id: string }; Returns: string }
      save_generated_core: { Args: { p_payload: Json }; Returns: string }
      save_generated_mission: {
        Args: { p_payload: Json; p_scenario_id: string }
        Returns: string
      }
      save_generated_scenario: { Args: { p_payload: Json }; Returns: string }
    }
    Enums: {
      app_role: "learner" | "admin"
      approval_status: "pending_approval" | "approved" | "rejected" | "inactive"
      auto_check_result: "pass" | "warning" | "fail"
      review_status:
        | "generated"
        | "needs_review"
        | "revise_required"
        | "revised"
        | "approved"
      speech_act:
        | "request"
        | "refusal"
        | "apology"
        | "thanks"
        | "proposal"
        | "agreement"
        | "opposition"
        | "compliment"
        | "complaint"
      usage_assignment:
        | "archived_only"
        | "coursework_published"
        | "experiment_locked"
        | "excluded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["learner", "admin"],
      approval_status: ["pending_approval", "approved", "rejected", "inactive"],
      auto_check_result: ["pass", "warning", "fail"],
      review_status: [
        "generated",
        "needs_review",
        "revise_required",
        "revised",
        "approved",
      ],
      speech_act: [
        "request",
        "refusal",
        "apology",
        "thanks",
        "proposal",
        "agreement",
        "opposition",
        "compliment",
        "complaint",
      ],
      usage_assignment: [
        "archived_only",
        "coursework_published",
        "experiment_locked",
        "excluded",
      ],
    },
  },
} as const
