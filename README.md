# TaskLog — Deploy con Neon + Render + Vercel

## Stack
- **Frontend:** React + Vite → deploy en Vercel
- **Backend:** Express → deploy en Render
- **Base de datos:** PostgreSQL (Neon en la nube)

---

## 1. Preparar la base de datos en Neon

1. Entrá a https://neon.tech y creá una cuenta gratuita.
2. Creá un nuevo proyecto (ej. `tasklog`).
3. Copiá la **Connection String** provista para PostgreSQL (tendrá una estructura similar a `postgresql://usuario:password@host/neondb?sslmode=require`).

Guardá este valor, lo vas a necesitar en los pasos siguientes como `DATABASE_URL`.

---

## 2. Deploy del Backend en Render

1. Subí este proyecto a GitHub.
2. Entrá a https://render.com y creá una cuenta gratuita.
3. Click en **New → Web Service**.
4. Conectá tu repositorio de GitHub.
5. Configurá:
   - **Name:** tasklog-api
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
6. En **Environment Variables** agregá:
   ```
   DATABASE_URL = postgresql://usuario:password@host/neondb?sslmode=require  (tu Connection String de Neon)
   NODE_ENV     = production
   FRONTEND_URL = https://tu-app.vercel.app  (lo completás después)
   ```
7. Click **Create Web Service**.
8. Esperá el deploy (~2 min). Copiá la URL que te da Render:
   → `https://tasklog-api.onrender.com`

---

## 3. Deploy del Frontend en Vercel

1. Entrá a https://vercel.com y creá una cuenta gratuita.
2. Click en **Add New → Project**.
3. Importá tu repositorio de GitHub.
4. En **Environment Variables** agregá:
   ```
   VITE_API_URL = https://tasklog-api.onrender.com
   ```
5. Click **Deploy**.
6. Copiá la URL que te da Vercel:
   → `https://tasklog-xxxx.vercel.app`

---

## 4. Actualizar CORS en Render

Volvé a Render → tu servicio → Environment Variables y actualizá:
```
FRONTEND_URL = https://tasklog-xxxx.vercel.app
```
Render va a hacer redeploy automático.

---

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Crear archivo .env (copiar desde .env.example)
cp .env.example .env
# (Completá la variable DATABASE_URL con tu conexión de Neon o una base de datos PostgreSQL local)

# Levantar app completa
npm run dev
```

App en http://localhost:5173

---

## Notas importantes

- **Render free:** el servidor se duerme después de 15 min sin uso.
  El primer request después de eso tarda ~30 segundos en despertar.
  Esto es normal en el plan gratuito.
- **Neon free:** Excelente plan gratuito con base de datos PostgreSQL serverless, escalado automático a cero y branching.
- **Backup:** podés usar la opción de Backup integrada en la barra de navegación de la aplicación para exportar todos tus proyectos y tareas en un archivo JSON firmemente estructurado y restaurarlo cuando lo desees.
