# Supabase

Backend del proyecto Sage. Las migraciones viven en `migrations/` en orden
cronológico por nombre de archivo.

## Cómo aplicar migraciones

Sin CLI (método actual): abre el **SQL Editor** del dashboard de Supabase,
pega el contenido del archivo de migración y ejecútalo. Aplica los archivos
en orden y solo una vez cada uno.

Con CLI (opcional): `supabase link --project-ref <ref>` y luego
`supabase db push`.

## Convenciones

- Todas las tablas públicas tienen **RLS habilitado** con políticas por
  usuario (`auth.uid() = id`).
- `profiles` se crea automáticamente vía trigger `on_auth_user_created`;
  la app nunca inserta perfiles, solo los actualiza.
