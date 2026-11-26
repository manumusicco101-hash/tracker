# Gastos · Seguimiento diario

App web mobile-first (PWA instalable) para registrar gastos diarios en pesos, dólares y euros, con compras en cuotas, gastos recurrentes, presupuestos, compromisos futuros y exportación a Excel.

**Stack:** Vite 8 · React 19 · TypeScript 7 · Tailwind CSS 4 · Lucide · Recharts 3 · vite-plugin-pwa. Los datos se guardan en LocalStorage a través de una capa de repositorios (lista para migrar a Supabase).

## Requisitos

- Node.js 22.12 o superior (probado con Node 24) y npm.

## Instalar y correr

```bash
npm install
npm run dev
```

Abrí <http://localhost:5173>. La primera vez se cargan 18 gastos de ejemplo de los últimos 10 días, para que todas las pantallas tengan datos. Se borran desde **Ajustes → Backup y datos → Borrar datos de ejemplo** (o con el aviso de Inicio).

Para probarla desde el celular en la misma red Wi-Fi:

```bash
npm run dev -- --host
```

y abrí la URL "Network" que muestra la terminal. Así se puede usar, pero **no instalar**: el service worker y la instalación necesitan HTTPS (ver más abajo).

## Build de producción

```bash
npm run build     # chequeo de tipos + build en dist/ (incluye service worker y manifest)
npm run preview   # sirve dist/ en http://localhost:4173
```

## Tests

```bash
npm test          # Vitest: cuotas, recurrentes, monedas, fechas, CSV, backup, repositorios
```

Los tests corren con la zona horaria `America/Argentina/Buenos_Aires` para cubrir el corrimiento de día de UTC-3.

## Instalar en el celular (PWA)

1. Publicá la carpeta `dist/` en cualquier hosting estático con HTTPS (Vercel, Netlify, Cloudflare Pages, GitHub Pages).
   - Configuración: build `npm run build`, carpeta de salida `dist`.
2. Abrí la URL en el celular:
   - **Android (Chrome):** menú ⋮ → *Instalar app*.
   - **iPhone (Safari):** botón Compartir → *Agregar a inicio*.

Cuando publiques una versión nueva, la app muestra el aviso "Hay una versión nueva" con el botón **Actualizar**.

Los íconos (`public/*.png`, `favicon.ico`) se generan desde `public/favicon.svg`:

```bash
npm run generate-pwa-assets
```

## Cómo funciona

### Modelo de datos (`src/types/index.ts`)

- **Fechas** como `YYYY-MM-DD` en hora local, parseadas a mano (`src/lib/dates.ts`). Nunca se usa `new Date('YYYY-MM-DD')`.
- **Montos** en centavos enteros (sin errores de punto flotante).
- **Un registro madre por compra.** Las cuotas y las ocurrencias recurrentes se calculan al vuelo (`src/lib/occurrences.ts`); nunca se guardan copias por mes.
- **Cotizaciones contra ARS (moneda pivote).** Cada gasto guarda `rateAtCreation`, la foto de todas las cotizaciones al cargarlo. Para convertir: `monto × tabla[origen] / tabla[base]`. Por eso cambiar la moneda base de ARS a USD no toca ningún registro.
- **Cotizaciones con etiqueta** (Oficial, MEP, Tarjeta…): se elige una al cargar un gasto en moneda extranjera.
- **Recurrentes en moneda extranjera:** cada ocurrencia usa la cotización vigente en su fecha, según el historial de cambios que se guarda al editar una cotización. Los gastos únicos y las cuotas usan siempre su `rateAtCreation`.
- **`schemaVersion`** en los datos y en los backups, con migraciones en `src/data/migrations.ts`.

### Reglas de cálculo (`src/lib/`)

| Regla | Dónde |
|---|---|
| Cuotas de 2 decimales; la última absorbe la diferencia | `installments.ts` → `splitInstallments` |
| Primera cuota este mes o el siguiente, mismo día (o el último del mes) | `installments.ts` → `installmentDates` |
| Recurrente mensual: el día 31 cae el último día del mes y vuelve al 31 | `recurring.ts` → `recurringDates` |
| Una cuota suma solo su valor, en su mes, cuando su fecha ya llegó | `aggregations.ts` |
| Un recurrente suma cuando su ocurrencia ya llegó (fecha ≤ hoy) | `occurrences.ts` → `isRealized` |
| "Total de hoy" = únicos + cuotas + recurrentes con fecha hoy | `aggregations.ts` → `totalOn` |
| Presupuesto: verde < 75 %, amarillo 75–99 %, rojo ≥ 100 % | `aggregations.ts` → `budgetLevel` |
| CSV para Excel AR: `;`, BOM UTF-8, coma decimal | `csv.ts` |

Si la primera cuota cae el mes siguiente, el día de la compra se muestra una fila informativa que no suma, para que se vea que la compra quedó cargada.

### Persistencia (`src/data/`)

Los componentes no tocan `localStorage`: usan el estado global (`src/state/AppDataProvider.tsx`), que solo habla con las interfaces de `src/data/repositories.ts`. La implementación actual (`localRepositories.ts`) guarda todo en una sola clave (`gastos-tracker:data`).

**Para migrar a Supabase:** implementá `Repositories` (gastos, categorías, ajustes y backup) contra Supabase y exportala en `src/data/index.ts`. No hace falta cambiar ningún componente, porque todos los métodos ya son asíncronos.

## Estructura

```
src/
├── types/            Interfaces del modelo de datos
├── lib/              Lógica pura y testeada: fechas, montos, cuotas, recurrentes,
│                     monedas, ocurrencias, totales, filtros, CSV, formulario
├── data/             Persistencia: storage, repositorios, validación, migraciones,
│                     backup, categorías por defecto y datos de ejemplo
├── state/            Estado global, toasts y diálogos de confirmación
├── hooks/            Fecha local, botón "atrás", teclado de iOS, tema, navegación
├── components/
│   ├── ui/           BottomSheet, Button, SegmentedControl, Chip, ProgressBar…
│   ├── quick-add/    Panel de carga rápida (monto, categorías, cuotas, cotización)
│   ├── expenses/     Lista agrupada por día, fila, detalle y filtros
│   ├── charts/       Dona por categoría y barras de 7 días (carga diferida)
│   ├── settings/     Cotizaciones, presupuesto, categorías, backup
│   ├── layout/       Navegación inferior, botón +, aviso de actualización
│   └── icons/        Íconos de categorías y métodos de pago
└── screens/          Inicio, Historial, Compromisos y Ajustes
```

## Notas de uso

- **Flujo de 3 toques:** `+` → escribir el monto → **Guardar** (o Enter). Todo lo demás viene precargado: última categoría y método, moneda base, hoy, pago único.
- **Editar o eliminar una cuota u ocurrencia** modifica el registro madre (la compra o la serie completa). La app lo avisa antes de confirmar, y eliminar ofrece "Deshacer" durante 5 segundos.
- **Cancelar un recurrente** frena las ocurrencias futuras y conserva las pasadas. **Cambiar monto desde la próxima** cierra la serie hoy y abre otra con el monto nuevo.
- **Eliminar una categoría** pasa sus gastos a "Otros", que no se puede eliminar.
- **Exportá un backup JSON de vez en cuando:** los datos viven solo en el navegador de cada dispositivo.
