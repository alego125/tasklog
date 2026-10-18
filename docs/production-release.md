# Publicar Cursor en los servicios existentes

Web: https://tasklog-eight.vercel.app
API: https://tasklog-je8z.onrender.com
Repositorio: https://github.com/alego125/tasklog

## Antes de actualizar

Guardar una copia o punto de restauración de la base PostgreSQL actual desde Neon. La nueva API aplica migraciones al iniciar; conservar también el commit anterior para poder recuperar el código. No reemplazar DATABASE_URL ni borrar la base existente. La base local de la demo no se publica.

## Render: servicio existente tasklog-je8z

- Runtime Node 24.
- Build: `npm ci --omit=dev`.
- Start: `npm start`.
- Health check: `/api/health`.
- `NODE_ENV=production`.
- `DATABASE_URL`: mantener la conexión actual de Neon.
- `FRONTEND_URL=https://tasklog-eight.vercel.app`.
- `JWT_SECRET`: conservar el secreto actual si cumple el mínimo de 32 bytes. Si falta o es corto, generar uno aleatorio en el panel; cambiarlo invalida sesiones anteriores.
- `TRUST_PROXY_HOPS=1`.
- No configurar `DATABASE_SSL=disable` para Neon.

## Vercel: proyecto existente tasklog-eight

- Framework Vite; Node 24.
- Install: `npm ci`.
- Build: `npm run build`.
- Output: `dist`.
- Variable Production: `VITE_API_URL=https://tasklog-je8z.onrender.com` (sin `/api`).
- Si cambia la variable, reconstruir el frontend.

## Orden de actualización

1. Configurar los valores anteriores y comprobar qué rama usa cada servicio. Si ambos usan main con despliegue automático, integrar la actualización disparará ambos despliegues.
2. Conservar el backup de Neon antes de integrar la actualización.
3. Publicar la API y comprobar sus logs: migraciones terminadas y servidor escuchando. Confirmar respuesta correcta de `/api/health`.
4. Publicar/reconstruir el frontend con la URL de API indicada.
5. Abrir la web, iniciar sesión con una cuenta existente, comprobar proyectos/reuniones, editar una tarea de prueba y recargar para confirmar persistencia. Comprobar también móvil y exportación de backup.

Si falla el arranque o una migración, revisar los logs antes de reintentar. Restaurar un backup puede descartar cambios posteriores: no hacerlo automáticamente.

## Validación previa de esta versión

- `npm run check`: lint, 33 pruebas y build correctos.
- `npm run test:browser`: 11 pruebas correctas.
- `npm audit --audit-level=moderate`: ninguna vulnerabilidad detectada.

La comprobación HTTP de los dominios publicados no se pudo realizar desde el entorno de preparación por restricciones de red. La verificación final debe realizarse desde los paneles de los servicios y el navegador.
