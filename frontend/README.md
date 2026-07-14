# Hotel CRM Frontend — Vite + React

## Setup

```bash
npm install
npm run dev       # desarrollo  → http://localhost:5173
npm run build     # producción  → dist/
npm run preview   # previsualizar el build
```

## Diferencias vs CRA

| CRA                         | Vite                          |
|-----------------------------|-------------------------------|
| `react-scripts start`       | `vite`                        |
| `process.env.REACT_APP_*`  | `import.meta.env.VITE_*`      |
| `src/index.js`              | `src/main.jsx`                |
| `public/index.html`         | `index.html` (raíz del proyecto) |
| `"type": "commonjs"` por defecto | `"type": "module"` requerido |

## Enrutador de servicios

Archivo clave: `src/config/api.config.js`

En **desarrollo** Vite proxea cada prefijo directamente al puerto del servicio:
```
/saas/*      → localhost:3001
/auth-api/*  → localhost:3002
/hotels/*    → localhost:3003
/guests-api/* → localhost:3004
/reservation/* → localhost:3005
/billing/*   → localhost:3007
/audit/*     → localhost:3008
/reporting/* → localhost:3009
```

En **producción** (nginx) los mismos prefijos son ruteados por el API Gateway.

### Cambiar entorno

```bash
# .env
VITE_ENV=development   # default
VITE_ENV=production    # nginx gateway
VITE_ENV=staging       # dominio de staging
```

O al levantar:
```bash
VITE_ENV=production npm run build
```

## Despliegue con Docker

```bash
npm run build
cp -r dist/ ../frontend/build/
docker-compose up --build -d
```

El build queda en `dist/` — cópialo a `frontend/build/` que nginx sirve en `/`.
