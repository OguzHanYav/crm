-- Löscht alle Benutzer aus der auth.users und public.users Tabelle außer den Admin
DELETE FROM auth.users
WHERE email != 'office@oguzhan-yavuz.com';

DELETE FROM public.users
WHERE email != 'office@oguzhan-yavuz.com';
