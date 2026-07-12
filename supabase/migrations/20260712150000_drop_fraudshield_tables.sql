-- Removes everything created by the previous 4 migrations, which belong to
-- an unrelated project ("FraudShield AI") whose Supabase CLI was mistakenly
-- linked to this project's database instead of its own. None of this was
-- ever referenced by Inventra's own code — safe, complete removal.
drop table if exists public.fraudshield_report_exports cascade;
drop table if exists public.fraudshield_cases cascade;
drop table if exists public.fraudshield_transactions cascade;
drop table if exists public.fraudshield_rules cascade;
drop table if exists public.fraudshield_audit_logs cascade;
drop table if exists public.fraudshield_known_devices cascade;
drop table if exists public.fraudshield_login_attempts cascade;
drop table if exists public.fraudshield_profiles cascade;
drop table if exists public.fraudshield_organizations cascade;

drop function if exists public.fraudshield_register_organization(text, text, text, text, text, text, text, text, text, text, text) cascade;
drop function if exists public.fraudshield_record_login_attempt(text, text, text, boolean) cascade;
drop function if exists public.fraudshield_is_locked_out(text) cascade;
drop function if exists public.fraudshield_current_role() cascade;
drop function if exists public.fraudshield_current_org() cascade;
