# Financial Intelligence Suite

Dashboard for benchmarking Spanish custodian/wealth management entities (Inversis, Allfunds, CACEIS, Cecabank, Renta 4) against BdE public financial data.

## Quarterly Update Runbook

Follow these steps each quarter after new BdE data is published.

### 1. Download source files

From the [BdE public statements portal](https://www.bde.es/), download the four statement files for the new period (YYYYMM) into `../inversis-dashboard/Financial data/`:

| File code | Statement |
|-----------|-----------|
| `4701_YYYYMM.xls` | Cuenta de Resultados (P&L) |
| `2701_YYYYMM.xls` | Balance — Activo |
| `2702_YYYYMM.xls` | Balance — Pasivo |
| `2703_YYYYMM.xls` | Balance — Patrimonio Neto |

### 2. Run extraction

```bash
cd extract
python extract_bde.py
```

Review the output for:
- `RECON WARN` lines — quarterly sums that diverge from annual by >€1M
- `ValueError` — unexpected column layout in a source file (template may have changed)
- Entity coverage — all 5 entities should appear in the final summary table

### 3. Validate output

```bash
# Quick sanity check: Inversis 2024 C/I should be ~70-75%
python -c "import json; d=json.load(open('src/data/annual.json')); print(d['data']['2024']['Inversis']['cost_to_income_pct'])"
```

### 4. Update macro context

If the rate environment has changed, update `MACRO_CONTEXT` in `src/lib/commentary.ts`:

```ts
const MACRO_CONTEXT = {
  asOf: "YYYY-QN",            // current quarter
  rateEnvironment: "cutting", // "cutting" | "hiking" | "neutral"
};
```

### 5. Build and review

```bash
npm run build
npm run preview
```

Spot-check: Executive Summary KPI cards, Quarterly tab trends, P&L Waterfall for Inversis.

### 6. Quality gates

```bash
npm run lint        # must pass with 0 errors
npx tsc --noEmit -p tsconfig.app.json  # must pass
```

---

## Development

```bash
npm install
npm run dev   # starts on http://localhost:5174
```

---

<!-- Original Vite template notes below -->
# React + TypeScript + Vite (template notes)

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
