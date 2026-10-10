
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
            "addresses": {
                  Row: {
                    "city": string,"created_at": string,"id": string,"is_default": boolean,"landmark": string | null,"line1": string,"line2": string | null,"name": string,"phone": string,"pincode": string,"state": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city": string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"landmark"?: string | null,"line1": string,"line2"?: string | null,"name": string,"phone": string,"pincode": string,"state": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "city"?: string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"landmark"?: string | null,"line1"?: string,"line2"?: string | null,"name"?: string,"phone"?: string,"pincode"?: string,"state"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "addresses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"admin_audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": Json | null,"entity": string | null,"entity_id": string | null,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: Json | null,"entity"?: string | null,"entity_id"?: string | null,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: Json | null,"entity"?: string | null,"entity_id"?: string | null,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cart_items": {
                  Row: {
                    "qty": number,"updated_at": string,"user_id": string,"variant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "qty": number,"updated_at"?: string,"user_id"?: string,"variant_id": string
                  }
                  Update: {
                    "qty"?: number,"updated_at"?: string,"user_id"?: string,"variant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"collections": {
                  Row: {
                    "bogo": boolean,"created_at": string,"description": string | null,"id": string,"image_path": string | null,"is_active": boolean,"name": string,"slug": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bogo"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"image_path"?: string | null,"is_active"?: boolean,"name": string,"slug": string,"sort"?: number
                  }
                  Update: {
                    "bogo"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"image_path"?: string | null,"is_active"?: boolean,"name"?: string,"slug"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"coupon_redemptions": {
                  Row: {
                    "coupon_id": string,"created_at": string,"id": string,"order_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coupon_id": string,"created_at"?: string,"id"?: string,"order_id": string,"user_id": string
                  }
                  Update: {
                    "coupon_id"?: string,"created_at"?: string,"id"?: string,"order_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupon_redemptions_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_redemptions_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_redemptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"coupons": {
                  Row: {
                    "code": string,"created_at": string,"description": string | null,"ends_at": string | null,"first_order_only": boolean,"id": string,"is_active": boolean,"max_discount": number | null,"min_order": number,"per_user_limit": number,"starts_at": string | null,"type": Database["public"]['Enums']["coupon_type"],"updated_at": string,"usage_limit": number | null,"used_count": number,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"description"?: string | null,"ends_at"?: string | null,"first_order_only"?: boolean,"id"?: string,"is_active"?: boolean,"max_discount"?: number | null,"min_order"?: number,"per_user_limit"?: number,"starts_at"?: string | null,"type": Database["public"]['Enums']["coupon_type"],"updated_at"?: string,"usage_limit"?: number | null,"used_count"?: number,"value"?: number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string | null,"ends_at"?: string | null,"first_order_only"?: boolean,"id"?: string,"is_active"?: boolean,"max_discount"?: number | null,"min_order"?: number,"per_user_limit"?: number,"starts_at"?: string | null,"type"?: Database["public"]['Enums']["coupon_type"],"updated_at"?: string,"usage_limit"?: number | null,"used_count"?: number,"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"inventory_movements": {
                  Row: {
                    "actor": string | null,"created_at": string,"delta": number,"id": number,"order_id": string | null,"reason": string,"variant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor"?: string | null,"created_at"?: string,"delta": number,"id"?: never,"order_id"?: string | null,"reason": string,"variant_id": string
                  }
                  Update: {
                    "actor"?: string | null,"created_at"?: string,"delta"?: number,"id"?: never,"order_id"?: string | null,"reason"?: string,"variant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_movements_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "family": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "family": string,"id"?: string,"name": string
                  }
                  Update: {
                    "family"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"order_items": {
                  Row: {
                    "gst_rate": number,"id": string,"image_path": string | null,"line_total": number,"mrp": number,"order_id": string,"product_id": string | null,"product_name": string,"product_slug": string,"qty": number,"sku": string,"unit_price": number,"variant_id": string | null,"variant_label": string
                  }
                  ComputedFields: never
                  Insert: {
                    "gst_rate": number,"id"?: string,"image_path"?: string | null,"line_total": number,"mrp": number,"order_id": string,"product_id"?: string | null,"product_name": string,"product_slug": string,"qty": number,"sku": string,"unit_price": number,"variant_id"?: string | null,"variant_label": string
                  }
                  Update: {
                    "gst_rate"?: number,"id"?: string,"image_path"?: string | null,"line_total"?: number,"mrp"?: number,"order_id"?: string,"product_id"?: string | null,"product_name"?: string,"product_slug"?: string,"qty"?: number,"sku"?: string,"unit_price"?: number,"variant_id"?: string | null,"variant_label"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"order_status_history": {
                  Row: {
                    "actor": string | null,"created_at": string,"from_status": Database["public"]['Enums']["order_status"] | null,"id": number,"note": string | null,"order_id": string,"to_status": Database["public"]['Enums']["order_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: never,"note"?: string | null,"order_id": string,"to_status": Database["public"]['Enums']["order_status"]
                  }
                  Update: {
                    "actor"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: never,"note"?: string | null,"order_id"?: string,"to_status"?: Database["public"]['Enums']["order_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_status_history_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "admin_note": string | null,"cancelled_at": string | null,"cf_payment_session_id": string | null,"checkout_key": string,"cod_fee": number,"contact_email": string | null,"coupon_code": string | null,"coupon_id": string | null,"created_at": string,"discount": number,"gst_amount": number,"id": string,"needs_refund": boolean,"offer_discount": number,"order_number": string,"paid_at": string | null,"payment_method": Database["public"]['Enums']["payment_method"],"payment_status": Database["public"]['Enums']["payment_status"],"reserved_until": string | null,"shipping_address": NonNullable<Json>,"shipping_fee": number,"status": Database["public"]['Enums']["order_status"],"subtotal": number,"total": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_note"?: string | null,"cancelled_at"?: string | null,"cf_payment_session_id"?: string | null,"checkout_key": string,"cod_fee"?: number,"contact_email"?: string | null,"coupon_code"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"discount"?: number,"gst_amount"?: number,"id"?: string,"needs_refund"?: boolean,"offer_discount"?: number,"order_number": string,"paid_at"?: string | null,"payment_method": Database["public"]['Enums']["payment_method"],"payment_status"?: Database["public"]['Enums']["payment_status"],"reserved_until"?: string | null,"shipping_address": NonNullable<Json>,"shipping_fee"?: number,"status": Database["public"]['Enums']["order_status"],"subtotal": number,"total": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "admin_note"?: string | null,"cancelled_at"?: string | null,"cf_payment_session_id"?: string | null,"checkout_key"?: string,"cod_fee"?: number,"contact_email"?: string | null,"coupon_code"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"discount"?: number,"gst_amount"?: number,"id"?: string,"needs_refund"?: boolean,"offer_discount"?: number,"order_number"?: string,"paid_at"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"],"payment_status"?: Database["public"]['Enums']["payment_status"],"reserved_until"?: string | null,"shipping_address"?: NonNullable<Json>,"shipping_fee"?: number,"status"?: Database["public"]['Enums']["order_status"],"subtotal"?: number,"total"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"cf_payment_id": string,"created_at": string,"id": string,"method": string | null,"order_id": string,"provider": string,"raw": Json | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"cf_payment_id": string,"created_at"?: string,"id"?: string,"method"?: string | null,"order_id": string,"provider"?: string,"raw"?: Json | null,"status": string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"cf_payment_id"?: string,"created_at"?: string,"id"?: string,"method"?: string | null,"order_id"?: string,"provider"?: string,"raw"?: Json | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"pincode_cache": {
                  Row: {
                    "checked_at": string,"city": string | null,"cod_available": boolean,"eta_days": number | null,"pincode": string,"serviceable": boolean,"state": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_at"?: string,"city"?: string | null,"cod_available"?: boolean,"eta_days"?: number | null,"pincode": string,"serviceable": boolean,"state"?: string | null
                  }
                  Update: {
                    "checked_at"?: string,"city"?: string | null,"cod_available"?: boolean,"eta_days"?: number | null,"pincode"?: string,"serviceable"?: boolean,"state"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"product_collections": {
                  Row: {
                    "collection_id": string,"product_id": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "collection_id": string,"product_id": string,"sort"?: number
                  }
                  Update: {
                    "collection_id"?: string,"product_id"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_collections_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "collections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_collections_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_images": {
                  Row: {
                    "alt": string | null,"created_at": string,"id": string,"product_id": string,"sort": number,"storage_path": string,"variant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt"?: string | null,"created_at"?: string,"id"?: string,"product_id": string,"sort"?: number,"storage_path": string,"variant_id"?: string | null
                  }
                  Update: {
                    "alt"?: string | null,"created_at"?: string,"id"?: string,"product_id"?: string,"sort"?: number,"storage_path"?: string,"variant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_images_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"product_notes": {
                  Row: {
                    "note_id": string,"product_id": string,"tier": Database["public"]['Enums']["note_tier"]
                  }
                  ComputedFields: never
                  Insert: {
                    "note_id": string,"product_id": string,"tier": Database["public"]['Enums']["note_tier"]
                  }
                  Update: {
                    "note_id"?: string,"product_id"?: string,"tier"?: Database["public"]['Enums']["note_tier"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_notes_note_id_fkey"
      columns: ["note_id"]
isOneToOne: false
      referencedRelation: "notes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_notes_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_variants": {
                  Row: {
                    "breadth_cm": number,"created_at": string,"height_cm": number,"id": string,"is_active": boolean,"label": string,"length_cm": number,"mrp": number,"price": number,"product_id": string,"size_ml": number,"sku": string,"sort": number,"stock": number,"updated_at": string,"weight_g": number
                  }
                  ComputedFields: never
                  Insert: {
                    "breadth_cm"?: number,"created_at"?: string,"height_cm"?: number,"id"?: string,"is_active"?: boolean,"label": string,"length_cm"?: number,"mrp": number,"price": number,"product_id": string,"size_ml": number,"sku": string,"sort"?: number,"stock"?: number,"updated_at"?: string,"weight_g"?: number
                  }
                  Update: {
                    "breadth_cm"?: number,"created_at"?: string,"height_cm"?: number,"id"?: string,"is_active"?: boolean,"label"?: string,"length_cm"?: number,"mrp"?: number,"price"?: number,"product_id"?: string,"size_ml"?: number,"sku"?: string,"sort"?: number,"stock"?: number,"updated_at"?: string,"weight_g"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_variants_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "concentration": Database["public"]['Enums']["concentration"],"created_at": string,"description": string | null,"gender": Database["public"]['Enums']["gender"],"gst_rate": number,"hsn_code": string,"id": string,"is_active": boolean,"is_featured": boolean,"is_gift_set": boolean,"name": string,"rating_avg": number,"rating_count": number,"search": unknown,"slug": string,"tagline": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "concentration": Database["public"]['Enums']["concentration"],"created_at"?: string,"description"?: string | null,"gender": Database["public"]['Enums']["gender"],"gst_rate"?: number,"hsn_code"?: string,"id"?: string,"is_active"?: boolean,"is_featured"?: boolean,"is_gift_set"?: boolean,"name": string,"rating_avg"?: number,"rating_count"?: number,"search"?: never,"slug": string,"tagline"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "concentration"?: Database["public"]['Enums']["concentration"],"created_at"?: string,"description"?: string | null,"gender"?: Database["public"]['Enums']["gender"],"gst_rate"?: number,"hsn_code"?: string,"id"?: string,"is_active"?: boolean,"is_featured"?: boolean,"is_gift_set"?: boolean,"name"?: string,"rating_avg"?: number,"rating_count"?: number,"search"?: never,"slug"?: string,"tagline"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string | null,"id": string,"marketing_opt_in": boolean,"phone": string | null,"role": Database["public"]['Enums']["user_role"],"terms_accepted_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"marketing_opt_in"?: boolean,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"terms_accepted_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"marketing_opt_in"?: boolean,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"terms_accepted_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "hits": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "hits": number,"key": string,"window_start": string
                  }
                  Update: {
                    "hits"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"refunds": {
                  Row: {
                    "amount": number,"cf_refund_id": string | null,"created_at": string,"id": string,"initiated_by": string,"order_id": string,"processed_at": string | null,"raw": Json | null,"reason": string | null,"refund_id": string,"status": Database["public"]['Enums']["refund_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"cf_refund_id"?: string | null,"created_at"?: string,"id"?: string,"initiated_by": string,"order_id": string,"processed_at"?: string | null,"raw"?: Json | null,"reason"?: string | null,"refund_id": string,"status"?: Database["public"]['Enums']["refund_status"]
                  }
                  Update: {
                    "amount"?: number,"cf_refund_id"?: string | null,"created_at"?: string,"id"?: string,"initiated_by"?: string,"order_id"?: string,"processed_at"?: string | null,"raw"?: Json | null,"reason"?: string | null,"refund_id"?: string,"status"?: Database["public"]['Enums']["refund_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"is_verified": boolean,"product_id": string,"rating": number,"status": Database["public"]['Enums']["review_status"],"title": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"is_verified"?: boolean,"product_id": string,"rating": number,"status"?: Database["public"]['Enums']["review_status"],"title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"is_verified"?: boolean,"product_id"?: string,"rating"?: number,"status"?: Database["public"]['Enums']["review_status"],"title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"shipment_events": {
                  Row: {
                    "description": string | null,"id": number,"location": string | null,"occurred_at": string,"raw": Json | null,"shipment_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"id"?: never,"location"?: string | null,"occurred_at": string,"raw"?: Json | null,"shipment_id": string,"status": string
                  }
                  Update: {
                    "description"?: string | null,"id"?: never,"location"?: string | null,"occurred_at"?: string,"raw"?: Json | null,"shipment_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shipment_events_shipment_id_fkey"
      columns: ["shipment_id"]
isOneToOne: false
      referencedRelation: "shipments"
      referencedColumns: ["id"]
    }
                  ]
                },"shipments": {
                  Row: {
                    "awb": string | null,"charges": number | null,"courier_id": string | null,"courier_name": string | null,"created_at": string,"dims": Json | null,"id": string,"is_active": boolean,"label_url": string | null,"order_id": string,"pickup_date": string | null,"provider": string,"provider_ref": string | null,"raw": Json | null,"status": string,"tracking_url": string | null,"updated_at": string,"weight_g": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "awb"?: string | null,"charges"?: number | null,"courier_id"?: string | null,"courier_name"?: string | null,"created_at"?: string,"dims"?: Json | null,"id"?: string,"is_active"?: boolean,"label_url"?: string | null,"order_id": string,"pickup_date"?: string | null,"provider"?: string,"provider_ref"?: string | null,"raw"?: Json | null,"status"?: string,"tracking_url"?: string | null,"updated_at"?: string,"weight_g"?: number | null
                  }
                  Update: {
                    "awb"?: string | null,"charges"?: number | null,"courier_id"?: string | null,"courier_name"?: string | null,"created_at"?: string,"dims"?: Json | null,"id"?: string,"is_active"?: boolean,"label_url"?: string | null,"order_id"?: string,"pickup_date"?: string | null,"provider"?: string,"provider_ref"?: string | null,"raw"?: Json | null,"status"?: string,"tracking_url"?: string | null,"updated_at"?: string,"weight_g"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shipments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"store_settings": {
                  Row: {
                    "key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"webhook_events": {
                  Row: {
                    "error": string | null,"event_key": string,"id": number,"payload": NonNullable<Json>,"processed_at": string | null,"provider": string,"received_at": string,"type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"event_key": string,"id"?: never,"payload": NonNullable<Json>,"processed_at"?: string | null,"provider": string,"received_at"?: string,"type"?: string | null
                  }
                  Update: {
                    "error"?: string | null,"event_key"?: string,"id"?: never,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider"?: string,"received_at"?: string,"type"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"wishlist_items": {
                  Row: {
                    "created_at": string,"product_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"product_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"product_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wishlist_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wishlist_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "public_reviews": {
                  Row: {
                    "author_name": string | null,"body": string | null,"created_at": string | null,"id": string | null,"is_verified": boolean | null,"product_id": string | null,"product_name": string | null,"product_slug": string | null,"rating": number | null,"title": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "reviews_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "_release_coupon":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"_reserve_order_stock":
{ Args: { "p_actor": string,"p_order_id": string,"p_reason": string }; Returns: boolean
                           },
"_restock_order":
{ Args: { "p_actor": string,"p_order_id": string,"p_reason": string }; Returns: undefined
                           },
"add_shipment_event":
{ Args: { "p_actor": string,"p_description": string,"p_location": string,"p_occurred_at": string,"p_raw"?: Json,"p_shipment_id": string,"p_status": string }; Returns: undefined
                           },
"adjust_stock":
{ Args: { "p_actor": string,"p_delta": number,"p_note"?: string,"p_reason": string,"p_variant_id": string }; Returns: number
                           },
"anonymize_user":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"apply_refund_status":
{ Args: { "p_cf_refund_id": string,"p_raw": Json,"p_refund_id": string,"p_status": Database["public"]['Enums']["refund_status"] }; Returns: undefined
                           },
"audit":
{ Args: { "p_action": string,"p_actor": string,"p_details"?: Json,"p_entity": string,"p_entity_id": string }; Returns: undefined
                           },
"cancel_order":
{ Args: { "p_actor": string,"p_order_id": string,"p_reason"?: string }; Returns: Json
                           },
"create_refund":
{ Args: { "p_actor": string,"p_amount": number,"p_order_id": string,"p_reason": string }; Returns: {
              "amount": number,
"cf_refund_id": string | null,
"created_at": string,
"id": string,
"initiated_by": string,
"order_id": string,
"processed_at": string | null,
"raw": Json | null,
"reason": string | null,
"refund_id": string,
"status": Database["public"]['Enums']["refund_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "refunds"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_shipment":
{ Args: { "p_actor": string,"p_awb": string,"p_courier_name": string,"p_order_id": string,"p_provider": string,"p_raw"?: Json,"p_tracking_url": string }; Returns: string
                           },
"expire_order_hold":
{ Args: { "p_order_id": string }; Returns: boolean
                           },
"get_setting":
{ Args: { "p_key": string }; Returns: Json
                           },
"hit_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mark_order_paid":
{ Args: { "p_actor"?: string,"p_amount": number,"p_cf_payment_id": string,"p_method": string,"p_order_number": string,"p_raw": Json }; Returns: string
                           },
"place_order":
{ Args: { "p_address": Json,"p_checkout_key": string,"p_contact_email"?: string,"p_coupon_code"?: string,"p_items": Json,"p_payment_method": Database["public"]['Enums']["payment_method"],"p_user_id": string }; Returns: Json
                           },
"quote_cart":
{ Args: { "p_coupon_code"?: string,"p_items": Json,"p_payment_method"?: Database["public"]['Enums']["payment_method"],"p_user_id": string }; Returns: Json
                           },
"record_payment":
{ Args: { "p_amount": number,"p_cf_payment_id": string,"p_method": string,"p_order_number": string,"p_raw": Json,"p_status": string }; Returns: string
                           },
"set_order_status":
{ Args: { "p_actor": string,"p_note"?: string,"p_order_id": string,"p_status": Database["public"]['Enums']["order_status"] }; Returns: undefined
                           },
"set_user_role":
{ Args: { "p_actor": string,"p_role": Database["public"]['Enums']["user_role"],"p_target": string }; Returns: undefined
                           }
          }
          Enums: {
            "concentration": "parfum"|"edp"|"edt"|"edc"|"attar"|"body_mist","coupon_type": "percent"|"flat"|"free_shipping","gender": "men"|"women"|"unisex","note_tier": "top"|"heart"|"base","order_status": "pending_payment"|"confirmed"|"processing"|"shipped"|"delivered"|"cancelled"|"payment_failed"|"rto"|"returned","payment_method": "prepaid"|"cod","payment_status": "pending"|"paid"|"failed"|"refunded"|"partially_refunded","refund_status": "pending"|"success"|"failed","review_status": "pending"|"approved"|"rejected","user_role": "customer"|"staff"|"admin"
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
            "concentration": ["parfum", "edp", "edt", "edc", "attar", "body_mist"],"coupon_type": ["percent", "flat", "free_shipping"],"gender": ["men", "women", "unisex"],"note_tier": ["top", "heart", "base"],"order_status": ["pending_payment", "confirmed", "processing", "shipped", "delivered", "cancelled", "payment_failed", "rto", "returned"],"payment_method": ["prepaid", "cod"],"payment_status": ["pending", "paid", "failed", "refunded", "partially_refunded"],"refund_status": ["pending", "success", "failed"],"review_status": ["pending", "approved", "rejected"],"user_role": ["customer", "staff", "admin"]
          }
        }
} as const
