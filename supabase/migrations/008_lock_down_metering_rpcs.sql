-- 008_lock_down_metering_rpcs.sql
-- Security hardening (QC finding, commit 8a3c34e audit).
--
-- These SECURITY DEFINER functions mutate profiles — the build-credit balance
-- and the monthly fair-use counter. Supabase grants EXECUTE on public-schema
-- functions to anon + authenticated by default, and none of these verify
-- p_user_id = auth.uid(). So a logged-in user (or anon-key holder) could call
-- them directly over PostgREST (POST /rest/v1/rpc/...) to:
--   * reset their own (or another user's) fair-use window — dodging the Core/Pro
--     Plan Pack soft cap entirely, and
--   * self-grant build credits via add_build_credits / refund_build_credit —
--     i.e. unlimited free Plan Packs on the owner's AI bill.
--
-- Fix: revoke EXECUTE from anon/authenticated/public and grant it only to the
-- service role. Every legitimate caller already uses the service-role client
-- (Stripe webhook -> add_build_credits; plan-pack route -> use_build_credit /
-- bump_plan_pack_usage, switched to the admin client in the same change).
-- Idempotent: revoke/grant are safe to re-run.

revoke execute on function public.use_build_credit(uuid)            from public, anon, authenticated;
revoke execute on function public.refund_build_credit(uuid)         from public, anon, authenticated;
revoke execute on function public.add_build_credits(uuid, integer)  from public, anon, authenticated;
revoke execute on function public.bump_plan_pack_usage(uuid, text)  from public, anon, authenticated;

grant execute on function public.use_build_credit(uuid)            to service_role;
grant execute on function public.refund_build_credit(uuid)         to service_role;
grant execute on function public.add_build_credits(uuid, integer)  to service_role;
grant execute on function public.bump_plan_pack_usage(uuid, text)  to service_role;
