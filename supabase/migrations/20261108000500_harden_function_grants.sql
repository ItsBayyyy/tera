-- Supabase security advisor fixes.
-- Postgres grants EXECUTE on new functions to PUBLIC, so the earlier `revoke ... from anon` left
-- these SECURITY DEFINER helpers callable without signing in via /rest/v1/rpc.

revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_admin() from public, anon;
-- RLS policies call these as the signed-in user; they only reveal the caller's own role.
grant execute on function public.current_app_role() to authenticated, service_role;
grant execute on function public.is_staff() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

-- Trigger-only function: nobody needs to call it directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter function public.touch_updated_at() set search_path = '';
