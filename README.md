# TaskLog — Deploy con Turso + Render + Vercel

## Stack
- **Frontend:** React + Vite → deploy en Vercel
- **Backend:** Express → deploy en Render
- **Base de datos:** Turso (SQLite en la nube)

---

## 1. Preparar la base de datos en Turso

```bash
# Instalar CLI de Turso
curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login

# Crear base de datos
turso db create tasklog

# Obtener la URL
turso db show tasklog --url
# → libsql://tasklog-tuusuario.turso.io

# Obtener el token
turso db tokens create tasklog
# → eyJhbGciOi...
```

Guardá estos dos valores, los vas a necesitar en los pasos siguientes.

---

## 2. Deploy del Backend en Render

1. Subí este proyecto a GitHub
2. Entrá a https://render.com y creá una cuenta gratuita
3. Click en **New → Web Service**
4. Conectá tu repositorio de GitHub
5. Configurá:
   - **Name:** tasklog-api
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
6. En **Environment Variables** agregá:
   ```
   TURSO_DATABASE_URL = libsql://tasklog-tuusuario.turso.io
   TURSO_AUTH_TOKEN   = eyJhbGciOi...  (tu token de Turso)
   NODE_ENV           = production
   FRONTEND_URL       = https://tu-app.vercel.app  (lo completás después)
   ```
7. Click **Create Web Service**
8. Esperá el deploy (~2 min). Copiá la URL que te da Render:
   → `https://tasklog-api.onrender.com`

---

## 3. Deploy del Frontend en Vercel

1. Entrá a https://vercel.com y creá una cuenta gratuita
2. Click en **Add New → Project**
3. Importá tu repositorio de GitHub
4. En **Environment Variables** agregá:
   ```
   VITE_API_URL = https://tasklog-api.onrender.com
   ```
5. Click **Deploy**
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
# (podés dejar las variables de Turso vacías, usará SQLite local)

# Levantar app completa
npm run dev
```

App en http://localhost:5173

---

## Notas importantes

- **Render free:** el servidor se duerme después de 15 min sin uso.
  El primer request después de eso tarda ~30 segundos en despertar.
  Esto es normal en el plan gratuito.
- **Turso free:** 500MB de almacenamiento, 1 billón de lecturas/mes.
  Más que suficiente para uso personal o de equipo pequeño.
- **Backup:** podés exportar tu BD con `turso db shell tasklog ".dump"` 
