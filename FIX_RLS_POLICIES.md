# 🔧 Instrucciones para Arreglar Políticas RLS de Descripciones

El problema es que las políticas RLS de `user_profile_descriptions` están negando acceso a todos los usuarios. Necesitas actualizar las políticas para permitir que los usuarios lean las descripciones.

## Pasos:

1. **Abre Supabase Studio**: https://app.supabase.com

2. **Selecciona tu proyecto** (el proyecto de prueba de MiniPeopleDB)

3. **Ve a SQL Editor** (en el menú izquierdo)

4. **Copia este SQL** y pégalo en el editor:

```sql
-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "rls_no_authenticated_access" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_anon_denied" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_users_read_own_description" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_users_read_public_descriptions" ON user_profile_descriptions;
DROP POLICY IF EXISTS "rls_no_authenticated_write" ON user_profile_descriptions;

-- Create permissive policies for reading descriptions
CREATE POLICY "rls_users_read_own_description" ON user_profile_descriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "rls_users_read_public_descriptions" ON user_profile_descriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() != user_id);

-- Create restrictive policies to block writes from authenticated users
CREATE POLICY "rls_no_authenticated_write" ON user_profile_descriptions
  AS RESTRICTIVE FOR UPDATE, DELETE, INSERT
  TO authenticated
  USING (FALSE);

CREATE POLICY "rls_anon_denied" ON user_profile_descriptions
  AS RESTRICTIVE FOR ALL
  TO anon
  USING (FALSE);
```

5. **Haz click en "Run"** (botón azul en la esquina inferior derecha)

6. **Verifica que no hay errores** (deberías ver "Success")

## ¿Qué hace esto?

- ❌ Elimina las políticas antiguas que negaban todo acceso
- ✅ Crea una política que permite que cada usuario lea su propia descripción
- ✅ Crea una política que permite que los usuarios lean descripciones públicas de otros
- 🔒 Bloquea escrituras y borrados desde usuarios autenticados (solo el worker puede escribir)

## Después de aplicar:

Las descripciones deberían aparecer en localhost:3001:
- **Tu descripción personal**: En el modal de DNA (botón "DNA" o "Mis datos")
- **Descripciones públicas**: En los perfiles de tus amigos (sección "Amigos" > click en perfil)

Si aún no ves descripciones, recarga la página (F5 o Ctrl+R).
