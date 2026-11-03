# 🔓 SQL para permitir lectura de descripciones

Ejecuta esto en Supabase SQL Editor para permitir que los usuarios lean descripciones:

```sql
-- OPCIÓN 1: Permitir lectura pública de descripciones (más simple)
-- Úsalo si quieres que cualquiera pueda ver las descripciones

DROP POLICY IF EXISTS "rls_users_read_own_description" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_users_read_public_descriptions" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_anon_read_descriptions" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_no_authenticated_write" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_anon_denied" ON user_profile_descriptions;

-- Permitir lectura a usuarios autenticados
CREATE POLICY "allow_select_own_description" ON user_profile_descriptions
  FOR SELECT
  USING (true);

-- Bloquear escrituras
CREATE POLICY "block_all_writes" ON user_profile_descriptions
  AS RESTRICTIVE FOR ALL
  USING (false);
```

O mejor aún, **DESHABILITA RLS completamente** para esta tabla (en desarrollo):

```sql
ALTER TABLE user_profile_descriptions DISABLE ROW LEVEL SECURITY;
```

Después recarga localhost:3001 (F5) y deberías ver las descripciones.
