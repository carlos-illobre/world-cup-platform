## Cambios

### 1. Scrollbar custom (look & feel del proyecto)
En `src/styles.css` agregar estilos globales de scrollbar (WebKit + Firefox) que combinen con el tema dark/neón:
- `::-webkit-scrollbar` 10px, track translúcido (`oklch(0.2 0.025 252 / 40%)`), thumb con gradiente azul→verde neón (`--neon-blue` → `--neon-green`), bordes redondeados, leve glow azul al hover.
- `scrollbar-color` y `scrollbar-width: thin` para Firefox.
- Aplicar a `html`/`body` y también al contenedor horizontal de fechas (`overflow-x-auto` en `MatchScheduleSelector`) para que se vea consistente.

### 2. Radar 20% más grande
En `src/components/dashboard/PhysiologicalPanel.tsx`:
- Cambiar el contenedor del radar de `max-w-[210px]` a `max-w-[252px]` (+20%).
- Ajustar el grid de `md:grid-cols-[200px_1fr]` y `xl:grid-cols-[210px_1fr_230px]` a `md:grid-cols-[240px_1fr]` y `xl:grid-cols-[252px_1fr_230px]`.

### 3. Compensar achicando barras de Sueño e Hidratación
En `StatBar` (revisar primero) o vía clase en `PhysiologicalPanel`, reducir la altura de las barras de calidad de sueño y nivel de hidratación (~20% menos alto, ej. de `h-3` a `h-2` o equivalente) para mantener balance visual.

## Fuera de alcance
- No se tocan datos, hooks, API ni otros paneles.
- No se redimensiona el SVG interno del radar (escala con el contenedor automáticamente vía `viewBox`).
