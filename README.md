# TaskLog

Gestión de proyectos, tareas, bitácoras y reuniones. React 18 + Vite 8 en el frontend; Express 4 y PostgreSQL en la API. Requiere Node.js 24 o posterior; desarrollo y CI utilizan Node 24.

## Desarrollo local

```bash
npm ci
cp .env.example .env
# Configurar DATABASE_URL y DATABASE_SSL para PostgreSQL local o Neon.
npm run dev
```

Frontend: http://localhost:5173. API: http://localhost:3001/api. Vite redirige `/api` al backend durante el desarrollo. Para Neon, eliminar `DATABASE_SSL=disable`: TLS se verifica siempre fuera de localhost.

La API aplica las migraciones versionadas antes de escuchar solicitudes. También se pueden ejecutar con `npm run migrate`. Las migraciones son transaccionales y se serializan entre instancias; cualquier fallo detiene el arranque. Las migraciones iniciales admiten el esquema legado y no borran datos existentes.

## Comandos de verificación

```bash
npm run lint
npm test
npm run build
npm run check               # lint + pruebas de API/cliente + build
npx playwright install chromium
npm run test:browser        # Chromium con API simulada
npm audit
```

Las pruebas de API usan PGlite, un motor PostgreSQL embebido con claves foráneas, transacciones y triggers. Para ejecutarlas contra un servidor PostgreSQL independiente, definir `TEST_DATABASE_URL`: crean y eliminan únicamente un esquema temporal propio. No usar una cuenta de producción para pruebas. GitHub Actions utiliza PostgreSQL 16 y comprueba también el navegador y la auditoría de dependencias.

Con Chromium ya instalado: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser`.

## Despliegue: Neon + Render + Vercel

1. Crear una base PostgreSQL en Neon y copiar su URL de conexión.
2. Crear el servicio de API en Render con `render.yaml`, o configurar manualmente:
   - Build: `npm ci --omit=dev`.
   - Start: `npm start`.
   - Node: 24.
   - `NODE_ENV=production`.
   - `DATABASE_URL`: conexión de Neon.
   - `FRONTEND_URL`: URL exacta del frontend; permite una lista separada por comas para varios orígenes conocidos.
   - `JWT_SECRET`: secreto aleatorio de al menos 32 bytes. El blueprint lo genera automáticamente. En configuración manual, generar uno con el comando de `.env.example`.
   - `TRUST_PROXY_HOPS=1` para el proxy de Render. Usar 0 sin proxy; no confiar arbitrariamente en cabeceras enviadas por el cliente.
3. Crear el frontend en Vercel usando el preset Vite, build `npm run build` y salida `dist`.
4. Definir **antes del build** `VITE_API_URL=https://tu-api.onrender.com` en Vercel. No incluir `/api` al final.
5. Completar `FRONTEND_URL` en Render con el dominio definitivo de Vercel y verificar `/api/health`.

Vercel publica únicamente archivos del frontend. No ejecuta otra copia de la API. Si se cambia `VITE_API_URL`, hay que reconstruir el frontend. En Render free, el primer acceso tras inactividad puede tardar en responder; el cliente espera hasta 45 segundos y permite reintentar.

La conexión a PostgreSQL verifica el certificado TLS. Para una CA privada se puede definir `DATABASE_CA_FILE`. Desactivar TLS solo está permitido para localhost mediante `DATABASE_SSL=disable`.

## Seguridad y permisos

- Las contraseñas nuevas requieren al menos 10 caracteres y admiten como máximo 72 bytes UTF-8, por el límite de bcrypt. Las contraseñas existentes siguen permitiendo iniciar sesión.
- Los JWT utilizan HS256, emisor y audiencia propios, caducan a los 90 minutos y requieren una sesión activa en la base de datos. Las sesiones caducan también tras 20 minutos sin solicitudes autenticadas.
- Cerrar sesión revoca el token en el servidor. Editar el perfil revoca las sesiones anteriores y emite una nueva. Cambiar email o contraseña requiere la contraseña actual.
- La clave es obligatoria en producción. En desarrollo, si no se configura una, se genera una clave efímera por arranque; no se utiliza un secreto público por defecto.
- Los miembros pueden editar tareas, notas y proyectos compartidos. Solo el propietario elimina un proyecto o modifica sus miembros; no se puede quitar al propietario. Las reuniones y sus temas son privados.
- Mover tareas, comentarios o notas exige acceso a origen y destino. Las operaciones compuestas se ejecutan en una única transacción/conexión.
- Se limitan los intentos de autenticación por IP, con una ventana en memoria de cada proceso. Para varios procesos o réplicas se debe aplicar un límite compartido en el proxy/servicio de entrada.
- La API valida tipos, longitudes, fechas, colores y prioridades. Los errores internos de PostgreSQL no se envían al navegador.

## Backup y recuperación

El menú de usuario permite descargar e importar backups JSON. El formato v2 incluye reuniones propias y todos los proyectos accesibles, archivados o activos, con tareas, prioridades, notas, comentarios y membresías. No incluye contraseñas ni sesiones. Los autores históricos se conservan como texto; las identidades importadas no se enlazan por identificadores externos de otra base de datos.

**Importar crea copias nuevas.** No elimina ni sobrescribe proyectos existentes, ni cambia identificadores globales. Se reasignan todas las referencias y el usuario que importa queda como propietario de sus copias. Importar el mismo archivo otra vez genera copias adicionales. Los proyectos compartidos del backup también se importan como copias independientes.

Por defecto, las copias son privadas. La casilla de restaurar colaboración permite compartir los proyectos independientes con cuentas existentes que coincidan por email; el propietario de las copias sigue siendo quien importa. Las cuentas que no existan se informan al terminar. Los temas de reunión conservan su privacidad. Validar los destinatarios antes de activar esa casilla.

Se admiten backups v1, aunque no pueden recuperar reuniones, prioridades o membresías que el archivo original no contenga. La importación valida todos los registros y referencias antes de escribir, y revierte todo si falla una inserción. Límite por archivo: 10 MB; hasta 50.000 registros por colección y 100.000 en total. Para recuperación integral del servicio, complementar estos backups personales con las copias de seguridad de PostgreSQL/Neon.

## Datos, fechas y sincronización

Los listados de proyectos y reuniones usan páginas de 50 registros (máximo 100 por solicitud) con cursor por ID. El cliente recorre las páginas para mantener completos los filtros, indicadores y exportaciones. Las notas y los comentarios se cargan al abrir un proyecto o una bitácora; las búsquedas globales y exportaciones solicitan el historial completo. Los contadores se conservan aunque el historial todavía no esté cargado.

Las vistas activas y los archivos cargados se actualizan cada 30 segundos, al recuperar el foco y al recibir cambios de otras pestañas. No hay WebSockets: las ediciones de otros usuarios aparecen en el siguiente refresco. Las escrituras se serializan dentro de cada colección y se aplican con la respuesta del servidor; una operación fallida no restaura una copia antigua de toda la lista. Al cambiar de cuenta se desmonta todo el estado del espacio de trabajo.

Las fechas sin hora se almacenan como `DATE`. Los instantes se almacenan como `TIMESTAMPTZ` y se presentan en `America/Argentina/Buenos_Aires`. Una tarea vence al terminar su fecha límite: durante ese día figura por vencer. Los tres días siguientes también se consideran próximos al vencimiento. Los informes y la interfaz utilizan la misma regla.

## Organización del código

- `server/app.js`: composición de la API, CORS y errores.
- `server/routes/`: autenticación, proyectos, tareas, notas, reuniones y recuperación.
- `server/access.js`, `auth.js`, `validation.js`: autorización, sesiones y validación.
- `server/db.js`, `migrations/`: conexión, transacciones y migraciones.
- `server/backup.js`, `projects-store.js`: recuperación y consultas agrupadas.
- `src/hooks/`: sesión, colecciones sincronizadas, archivos y filtros.
- `src/components/`: vistas, controles y diálogos accesibles.
- `src/utils/`: fechas, notificaciones entre pestañas y exportaciones.
- `tests/`: integración API, pruebas del cliente y recorridos de navegador.

Los informes de IA se descargan como archivos de texto con prompts. La exportación Excel utiliza XML Spreadsheet con extensión `.xls`; no se genera un PDF. El documento `ANALISIS_PROYECTO.md` conserva el diagnóstico previo a estas correcciones.

## Probar sin configurar PostgreSQL

Con Node 24 o superior, ejecutá desde la carpeta del proyecto:

```bash
npm ci
npm run dev:local
```

Abrí http://localhost:5173 en el mismo equipo donde ejecutaste el comando.
La cuenta inicial es `demo`, con contraseña `TasklogDemo2026!`.
Este modo utiliza la API real con PostgreSQL embebido (PGlite), guarda los datos
en `data/local-preview` y no utiliza `DATABASE_URL` ni la base de producción.
Podés crear tu propia cuenta desde Registrarse. Para detenerlo, usá Ctrl+C.

Si Codex se ejecuta en un entorno remoto, su dirección localhost no corresponde
a tu equipo: el comando debe ejecutarse en tu terminal local o mediante un puerto
reenviado por el entorno.
