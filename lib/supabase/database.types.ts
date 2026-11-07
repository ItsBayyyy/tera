
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_config": {
                  Row: {
                    "key": string,"note": string | null,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"note"?: string | null,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"note"?: string | null,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"banjars": {
                  Row: {
                    "created_at": string,"district": string | null,"id": string,"is_demo": boolean,"is_sample": boolean,"name": string,"regency": string | null,"village": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"district"?: string | null,"id"?: string,"is_demo"?: boolean,"is_sample"?: boolean,"name": string,"regency"?: string | null,"village"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"district"?: string | null,"id"?: string,"is_demo"?: boolean,"is_sample"?: boolean,"name"?: string,"regency"?: string | null,"village"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"bite_reports": {
                  Row: {
                    "banjar_id": string | null,"bitten_at": string | null,"body_part": string | null,"case_code": string,"confirmed_dog_id": string | null,"contact_consent": boolean,"contact_phone": string | null,"created_at": string,"id": string,"lat": number | null,"lon": number | null,"match_log_id": string | null,"match_score": number | null,"matched_dog_id": string | null,"officer_note": string | null,"photo_path": string | null,"status": Database["public"]['Enums']["report_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "banjar_id"?: string | null,"bitten_at"?: string | null,"body_part"?: string | null,"case_code": string,"confirmed_dog_id"?: string | null,"contact_consent"?: boolean,"contact_phone"?: string | null,"created_at"?: string,"id"?: string,"lat"?: number | null,"lon"?: number | null,"match_log_id"?: string | null,"match_score"?: number | null,"matched_dog_id"?: string | null,"officer_note"?: string | null,"photo_path"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"updated_at"?: string
                  }
                  Update: {
                    "banjar_id"?: string | null,"bitten_at"?: string | null,"body_part"?: string | null,"case_code"?: string,"confirmed_dog_id"?: string | null,"contact_consent"?: boolean,"contact_phone"?: string | null,"created_at"?: string,"id"?: string,"lat"?: number | null,"lon"?: number | null,"match_log_id"?: string | null,"match_score"?: number | null,"matched_dog_id"?: string | null,"officer_note"?: string | null,"photo_path"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bite_reports_banjar_id_fkey"
      columns: ["banjar_id"]
isOneToOne: false
      referencedRelation: "banjars"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bite_reports_confirmed_dog_id_fkey"
      columns: ["confirmed_dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bite_reports_match_log_id_fkey"
      columns: ["match_log_id"]
isOneToOne: false
      referencedRelation: "match_logs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bite_reports_matched_dog_id_fkey"
      columns: ["matched_dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    }
                  ]
                },"dog_photos": {
                  Row: {
                    "created_at": string,"dog_id": string,"embedding": unknown,"id": string,"model_version": string | null,"quality_score": number | null,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dog_id": string,"embedding"?: unknown,"id"?: string,"model_version"?: string | null,"quality_score"?: number | null,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"dog_id"?: string,"embedding"?: unknown,"id"?: string,"model_version"?: string | null,"quality_score"?: number | null,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dog_photos_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    }
                  ]
                },"dogs": {
                  Row: {
                    "banjar_id": string,"color": string,"created_at": string,"created_by": string | null,"demo_seed": boolean,"id": string,"nickname": string | null,"owner_name": string | null,"owner_phone": string | null,"ownership": Database["public"]['Enums']["dog_ownership"],"sex": Database["public"]['Enums']["dog_sex"]
                  }
                  ComputedFields: never
                  Insert: {
                    "banjar_id": string,"color": string,"created_at"?: string,"created_by"?: string | null,"demo_seed"?: boolean,"id"?: string,"nickname"?: string | null,"owner_name"?: string | null,"owner_phone"?: string | null,"ownership"?: Database["public"]['Enums']["dog_ownership"],"sex"?: Database["public"]['Enums']["dog_sex"]
                  }
                  Update: {
                    "banjar_id"?: string,"color"?: string,"created_at"?: string,"created_by"?: string | null,"demo_seed"?: boolean,"id"?: string,"nickname"?: string | null,"owner_name"?: string | null,"owner_phone"?: string | null,"ownership"?: Database["public"]['Enums']["dog_ownership"],"sex"?: Database["public"]['Enums']["dog_sex"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "dogs_banjar_id_fkey"
      columns: ["banjar_id"]
isOneToOne: false
      referencedRelation: "banjars"
      referencedColumns: ["id"]
    }
                  ]
                },"duplicate_flags": {
                  Row: {
                    "candidate_dog_id": string,"created_at": string,"dog_id": string,"id": string,"resolved_by": string | null,"score": number,"status": Database["public"]['Enums']["duplicate_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "candidate_dog_id": string,"created_at"?: string,"dog_id": string,"id"?: string,"resolved_by"?: string | null,"score": number,"status"?: Database["public"]['Enums']["duplicate_status"]
                  }
                  Update: {
                    "candidate_dog_id"?: string,"created_at"?: string,"dog_id"?: string,"id"?: string,"resolved_by"?: string | null,"score"?: number,"status"?: Database["public"]['Enums']["duplicate_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "duplicate_flags_candidate_dog_id_fkey"
      columns: ["candidate_dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "duplicate_flags_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    }
                  ]
                },"facilities": {
                  Row: {
                    "address": string | null,"handles_bites": boolean,"id": string,"lat": number | null,"lon": number | null,"name": string,"phone": string | null,"readiness_note": string | null,"type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"handles_bites"?: boolean,"id"?: string,"lat"?: number | null,"lon"?: number | null,"name": string,"phone"?: string | null,"readiness_note"?: string | null,"type": string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"handles_bites"?: boolean,"id"?: string,"lat"?: number | null,"lon"?: number | null,"name"?: string,"phone"?: string | null,"readiness_note"?: string | null,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"match_logs": {
                  Row: {
                    "actor_id": string | null,"banjar_id": string | null,"chosen_dog_id": string | null,"created_at": string,"id": string,"source": Database["public"]['Enums']["match_source"],"top_candidates": NonNullable<Json>,"zone": Database["public"]['Enums']["match_zone"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"banjar_id"?: string | null,"chosen_dog_id"?: string | null,"created_at"?: string,"id"?: string,"source": Database["public"]['Enums']["match_source"],"top_candidates"?: NonNullable<Json>,"zone": Database["public"]['Enums']["match_zone"]
                  }
                  Update: {
                    "actor_id"?: string | null,"banjar_id"?: string | null,"chosen_dog_id"?: string | null,"created_at"?: string,"id"?: string,"source"?: Database["public"]['Enums']["match_source"],"top_candidates"?: NonNullable<Json>,"zone"?: Database["public"]['Enums']["match_zone"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_logs_banjar_id_fkey"
      columns: ["banjar_id"]
isOneToOne: false
      referencedRelation: "banjars"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_logs_chosen_dog_id_fkey"
      columns: ["chosen_dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"default_banjar_id": string | null,"full_name": string,"role": Database["public"]['Enums']["user_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_banjar_id"?: string | null,"full_name"?: string,"role"?: Database["public"]['Enums']["user_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"default_banjar_id"?: string | null,"full_name"?: string,"role"?: Database["public"]['Enums']["user_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_default_banjar_id_fkey"
      columns: ["default_banjar_id"]
isOneToOne: false
      referencedRelation: "banjars"
      referencedColumns: ["id"]
    }
                  ]
                },"vaccinations": {
                  Row: {
                    "ai_status": Database["public"]['Enums']["ai_status"],"batch": string | null,"created_at": string,"dog_id": string,"id": string,"officer_id": string | null,"vaccinated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_status": Database["public"]['Enums']["ai_status"],"batch"?: string | null,"created_at"?: string,"dog_id": string,"id"?: string,"officer_id"?: string | null,"vaccinated_at"?: string
                  }
                  Update: {
                    "ai_status"?: Database["public"]['Enums']["ai_status"],"batch"?: string | null,"created_at"?: string,"dog_id"?: string,"id"?: string,"officer_id"?: string | null,"vaccinated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vaccinations_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "banjar_coverage":
{ Args: Record<PropertyKey, never>; Returns: {
              "banjar_id": string,"bite_reports": number,"district": string,"dogs_registered": number,"dogs_vaccinated_active": number,"is_sample": boolean,"name": string,"regency": string,"village": string
            }[]
                           },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"match_dogs":
{ Args: { "p_banjar_id": string,"p_k"?: number,"query": unknown }; Returns: {
              "banjar_id": string,"best_photo_path": string,"best_score": number,"color": string,"dog_id": string,"last_ai_status": Database["public"]['Enums']["ai_status"],"last_vaccinated_at": string,"nickname": string,"ownership": Database["public"]['Enums']["dog_ownership"],"sex": Database["public"]['Enums']["dog_sex"]
            }[]
                           }
          }
          Enums: {
            "ai_status": "verified"|"pending"|"manual","dog_ownership": "owned"|"stray"|"unknown","dog_sex": "male"|"female"|"unknown","duplicate_status": "open"|"dismissed"|"merged","match_source": "officer"|"citizen"|"demo","match_zone": "strong"|"unsure"|"none","report_status": "new"|"in_progress"|"closed","user_role": "officer"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "ai_status": ["verified", "pending", "manual"],"dog_ownership": ["owned", "stray", "unknown"],"dog_sex": ["male", "female", "unknown"],"duplicate_status": ["open", "dismissed", "merged"],"match_source": ["officer", "citizen", "demo"],"match_zone": ["strong", "unsure", "none"],"report_status": ["new", "in_progress", "closed"],"user_role": ["officer", "admin"]
          }
        }
} as const
