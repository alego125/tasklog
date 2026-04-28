# Rediseño Visual — Estilo Japandi

**Fecha:** 2026-04-28  
**App:** Cursor (TaskLog) — React + Vite + Express + PostgreSQL  
**Rama de implementación:** `feature/japandi-redesign`  
**Enfoque:** Opción A — CSS Variables + override layer (sin tocar lógica)

---

## Contexto

La app "Cursor" es un sistema de seguimiento de tareas con autenticación, proyectos, tareas, bitácoras, backup y exportación. Visualmente usa un esquema dark blue-gray genérico con estilos inline en prácticamente todos los componentes. El objetivo es aplicar un rediseño visual completo con estilo **Japandi** (fusión japonés-escandinava) sin alterar ninguna funcionalidad.

El estilo fue seleccionado aleatoriamente usando `$RANDOM` bash (valor 20813, índice 13/25) y aprobado por el usuario tras comparar previews interactivos de varios estilos.

---

## Estilo: Japandi

**Concepto:** Fusión japonés-escandinava. Zen + Hygge. Funcionalidad como belleza. Calidez sin ornamento.

**Principios:**
- Fondo lino cálido — nunca frío ni azulado
- Espacio en blanco intencional y abundante
- Tipografía como estructura visual
- Nada decorativo que no sea también funcional
- Dark mode como carbón cálido, no como azul frío

---

## Sistema de tokens (theme.css)

### Modo claro (default — Japandi Light)

| Token CSS | Valor | Descripción |
|---|---|---|
| `--bg-base` | `#f5f0e8` | Lino cálido — fondo principal |
| `--bg-surface` | `#ede8df` | Superficie de cards y paneles |
| `--bg-elevated` | `#e6e0d4` | Elementos elevados |
| `--bg-hover` | `#ede2d0` | Hover state |
| `--border` | `#ddd5c5` | Bordes principales |
| `--border-soft` | `#e8e0d0` | Bordes suaves |
| `--text-primary` | `#2c2620` | Sumi — texto principal |
| `--text-secondary` | `#6b5e52` | Texto secundario |
| `--text-muted` | `#9c8e82` | Texto desvanecido |
| `--text-faint` | `#b8a898` | Texto muy tenue |
| `--input-bg` | `#f5f0e8` | Fondo de inputs |
| `--accent` | `#7a9e7e` | Sage green — acento principal |
| `--accent-deep` | `#4a6e4e` | Sage oscuro |
| `--header-bg` | `#ede8df` | Fondo del header |
| `--splash-bg` | `linear-gradient(135deg, #f5f0e8, #ede8df, #e6e0d4)` | Fondo splash |
| `--text-content` | `#2c2620` | Contenido de bitácoras |
| `--task-title` | `#3a2e28` | Título de tarea |
| `--btn-primary` | `#2c2620` | Botón primario (sumi sólido) |
| `--btn-primary-text` | `#f5f0e8` | Texto en botón primario |

### Modo oscuro (Japandi Dark — clase `.dark` en body)

> **Nota de implementación:** El app actual activa `.light` para el tema claro. En Japandi, claro es el default, así que la clase toggle cambia a `.dark`. Requiere cambiar **una sola línea** en `App.jsx`: `document.body.classList.toggle('dark', theme === 'dark')` y actualizar `doLogout` para remover `'dark'` en vez de `'light'`. Esto es cambio de CSS class name, no de lógica.

| Token CSS | Valor | Descripción |
|---|---|---|
| `--bg-base` | `#1e1a15` | Carbón cálido |
| `--bg-surface` | `#2a241c` | Superficie oscura |
| `--bg-elevated` | `#332b22` | Elevado oscuro |
| `--bg-hover` | `#3a3028` | Hover oscuro |
| `--border` | `#3a3028` | Bordes oscuros |
| `--border-soft` | `#4a3e32` | Bordes suaves oscuros |
| `--text-primary` | `#e8dfc8` | Crema — texto principal oscuro |
| `--text-secondary` | `#b8a888` | Texto secundario oscuro |
| `--text-muted` | `#7a6e60` | Muted oscuro |
| `--text-faint` | `#5a4e42` | Faint oscuro |
| `--accent` | `#7a9e7e` | Sage (mismo) |
| `--btn-primary` | `#7a9e7e` | Botón primario en dark = sage |
| `--btn-primary-text` | `#1e1a15` | Texto oscuro en botón sage |
| `--header-bg` | `#2a241c` | Header oscuro |

---

## Sistema tipográfico

### Fuentes (Google Fonts — importar en `index.html` como `<link>` para mejor performance)

```
DM Serif Display — italic 400 (headings, logos, nombres de proyecto)
Plus Jakarta Sans — 300, 400, 500, 600, 700 (toda la UI)
DM Mono — 400, 500 (estados, fechas, datos técnicos)
```

### Escala de uso

| Rol | Fuente | Peso | Uso |
|---|---|---|---|
| Display / marca | DM Serif Display italic | 400 | Logo, nombres de proyecto, títulos de sección, stats |
| Heading | DM Serif Display | 400 | Títulos de modales, encabezados secundarios |
| UI Body | Plus Jakarta Sans | 400–600 | Tareas, botones, filtros, inputs, labels |
| Meta / datos | DM Mono | 400–500 | Estados (por vencer, vencida), fechas, IDs, porcentajes |

---

## Archivos a modificar

### `src/theme.css` — REESCRIBIR COMPLETO
- Reemplazar todos los tokens con los valores Japandi (tabla arriba)
- Agregar `@import` de Google Fonts al inicio
- Renombrar selector `.light { ... }` a `.dark { ... }` con tokens Japandi Dark
- Ajustar transiciones a `0.2s ease` (mantener)
- Scrollbar personalizado: thumb `#ddd5c5`, track `#f5f0e8`

### `src/japandi.css` — NUEVO
Archivo de override para elementos que usan inline styles hardcodeados.

Contenido:
- `font-family` global en `body` y `*`
- Clase `.proj-title` → `font-family: 'DM Serif Display', serif; font-style: italic`
- Clase `.app-logo-text` → serif italic para el logo
- Clase `.status-badge` → `font-family: 'DM Mono', monospace`
- Box-shadow card suave: `0 2px 12px rgba(44,38,32,0.07)`
- Clase `.neu-card` con sombra y border-radius 14px
- Animación hover en botones: `opacity: 0.85` en `0.15s`
- Scrollbar CSS (`-webkit-scrollbar`)

### `index.html`
- Agregar `<link>` para Google Fonts (preconnect + stylesheet)
- Agregar `<link rel="stylesheet" href="/src/japandi.css">` (o importar en main.jsx)

### `src/components/Header.jsx`
- Agregar clase `app-logo-text` al div del nombre "Cursor"
- Cambiar `fontFamily` del sub-texto a `'DM Mono', monospace`
- Botón "+ Nuevo Proyecto": `borderRadius: 8px`, eliminar gradient si existiera

### `src/components/ProjectCard.jsx`
- Agregar clase `proj-title` al nombre del proyecto
- Barra lateral de color izquierda: `width: 3px` como acento (reemplaza el borde-left actual)
- Agregar porcentaje de tareas completadas visible junto al nombre (calculado de datos existentes: `done/total*100`, sin nuevas API calls)
- Cards: agregar clase `neu-card` para sombra suave

### `src/components/TaskItem.jsx`
- Badge de estado: agregar clase `status-badge` para DM Mono
- Checkbox: `borderRadius: 4px`, `border: 1.5px solid var(--border)`
- Título de tarea: `fontFamily: "'Plus Jakarta Sans', sans-serif"`

### `src/components/AuthScreen.jsx`
- Layout: panel izquierdo sumi oscuro con logo serif, panel derecho lino con formulario
- Logo: agregar clase `app-logo-text`
- Inputs: `background: var(--input-bg)`, sin glow azul en focus
- Botón: `background: var(--btn-primary)`, `borderRadius: 8px`

### `src/components/Modals.jsx`
- Overlay: `background: rgba(44,38,32,0.4)` (en lugar de `#000b`)
- Modal inner: `background: var(--bg-base)`, `borderRadius: 14px`
- Títulos: agregar clase `proj-title` donde corresponda

---

## Estados especiales

| Pantalla | Cambio clave |
|---|---|
| **Splash de carga** | Fondo lino, logo serif italic centrado, barra sage animada |
| **Error de conexión** | Fondo lino, texto sumi, botón reintentar en sumi |
| **Login** | Panel izquierdo sumi con logo grande, panel derecho formulario lino |
| **Toast success** | `#eaf3eb` fondo, `#2c5e30` texto, borde sage suave |
| **Toast warning** | `#faf0e8` fondo, `#7a4820` texto, borde terracotta suave |
| **Toast error** | `#f5eaea` fondo, `#6e2828` texto, borde rojo cálido |

---

## Lo que NO cambia

- Toda la lógica de React (hooks, estado, efectos)
- Llamadas a la API y manejo de errores
- Validaciones de formularios
- Filtros, búsqueda y exportación
- Estructura de componentes y props
- Backend (server/) — sin cambios
- Base de datos y migraciones

---

## Estrategia de rama y merge

1. Crear rama `feature/japandi-redesign` desde `main`
2. Implementar todos los cambios visuales en esa rama
3. Verificar visualmente en el browser (dev server)
4. Usuario aprueba el resultado visual
5. Merge a `main` y push al repo online

---

## Criterios de éxito

- [ ] Fondo lino cálido visible en toda la app (no blue-gray)
- [ ] Nombres de proyectos en DM Serif Display italic
- [ ] Botones primarios en sumi sólido (no gradient)
- [ ] Estados de tareas en DM Mono lowercase
- [ ] Dark mode funcional con tokens carbón cálido
- [ ] Login con panel partido sumi/lino
- [ ] Toasts con colores cálidos (no neón)
- [ ] Sin regresiones funcionales en filtros, modales y exportación
