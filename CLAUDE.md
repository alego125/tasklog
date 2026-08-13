# Notas para trabajar en este repo

## `japandi.css` tiene reglas `!important` que pisan estilos en línea/animaciones

`src/japandi.css` fija varias propiedades con `!important`:
- `.neu-card { box-shadow: ... !important; }` (light y dark)
- `input:focus, select:focus, textarea:focus { outline: ... !important; }`

Si agregás una animación CSS (`@keyframes`) que anima `box-shadow` en un
elemento con clase `.neu-card`, o `outline` en un `input`/`select`/`textarea`
enfocado, **no se va a ver** — la regla `!important` gana aunque la animación
esté corriendo (se puede confirmar con devtools: el `computed style` nunca
cambia). Pasó exactamente esto con el resalte del proyecto recién creado:
la primera versión animaba `box-shadow` y no se veía; se corrigió animando
`outline` en su lugar (sin conflicto en ese caso, pero comprobalo antes).

**Antes de animar una propiedad CSS en un elemento existente**, buscá si esa
propiedad ya está fijada con `!important` en `japandi.css`/`theme.css` para
ese selector (`grep -n "propiedad.*!important" src/*.css`).

## Este sandbox no tiene acceso a la base de datos real

No hay conexión TCP a Postgres/Neon en este entorno (solo HTTPS saliente vía
proxy). Para verificar features de UI de punta a punta sin depender del
usuario para probarlas:

```bash
npm run build
npx vite preview --port 4173 --strictPort &
```

y usar Playwright (instalado en `/opt/node22/lib/node_modules/playwright`,
Chromium en `/opt/pw-browsers/chromium`) con `page.route('**/api/**', ...)`
para mockear las respuestas del backend (login, listar/crear proyectos,
etc.) en vez de pegarle a la API real. Esto permite tomar screenshots y
verificar clases CSS/estado del DOM en un navegador real — mucho más
confiable que solo revisar el código, y detectó el bug de `!important` de
arriba que una revisión de código no hubiera encontrado.

## Filtros pueden ocultar entidades recién creadas

Un proyecto (o tarea) recién creado arranca "vacío" (sin tareas, sin
vencimiento, etc.). Cualquier filtro activo en ese momento — estado
(`filterStatuses`), búsqueda de texto (`search`), proyecto (`filterProject`)
— puede dejarlo completamente afuera del DOM porque no matchea nada. Toda
funcionalidad de tipo "crear y llevar a la vista" (scroll automático,
resalte, etc.) tiene que limpiar **todos** los filtros que podrían ocultar
la entidad nueva, no solo el más obvio. Ver `scrollToNewProject` en
`src/App.jsx`.
