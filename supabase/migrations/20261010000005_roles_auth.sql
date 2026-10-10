-- =============================================================================
-- Roles (customer / staff / admin), signup consent fields, admin audit log.
-- =============================================================================

alter type public.user_role add value if not exists 'staff' before 'admin';
