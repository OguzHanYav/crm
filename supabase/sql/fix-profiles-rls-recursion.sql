-- Behebt "infinite recursion detected in policy for relation profiles":
-- Policies auf public.profiles fragten zur Rechteprüfung wiederum public.profiles ab.
-- Die SECURITY DEFINER-Funktion is_admin() umgeht RLS bei dieser internen Prüfung.

-- 1. Helper-Funktion zur Vermeidung von Rekursion
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
$$;

-- 2. Bestehende problematische Policies droppen
drop policy if exists "Admins can insert profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "profiles_delete_admin_only" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_policy" on public.profiles;
drop policy if exists "profiles_insert_policy" on public.profiles;
drop policy if exists "profiles_update_policy" on public.profiles;
drop policy if exists "profiles_delete_policy" on public.profiles;

-- 3. Saubere Policies ohne Rekursion erstellen
create policy "profiles_select_policy" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "profiles_insert_policy" on public.profiles
  for insert with check (auth.uid() = id or public.is_admin());

create policy "profiles_update_policy" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

create policy "profiles_delete_policy" on public.profiles
  for delete using (public.is_admin());
