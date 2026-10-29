# Semilla Lab · Guía técnica

Votación del público por stands para Semilla Lab (Camposol). Para el uso funcional ver **[MANUAL.md](MANUAL.md)**.

- Producción actual: https://semilla-lab-camposol.netlify.app (Netlify, sitio `semilla-lab-camposol`)
- Sin framework ni build: HTML + CSS + JavaScript (ES modules) en el front; funciones Node en el back.
- Node **18 o superior**.

## Estructura

```
public/                 Front (se sirve tal cual)
  index.html            App del participante (SPA)
  app.js                Lógica: rutas (?stand=, ?v=ingresar), registro, votación, escáner QR
  styles.css            Sistema visual v2 (brutalismo sobre blanco)
  palette.js            Color por stand + opciones de "lo más fuerte" (compartido con el panel)
  admin/                Panel de administración (index.html + admin.js)
  assets/               Logos Camposol y marca Semilla Lab
netlify/functions/      Back (API). Cada archivo exporta un handler (Request → Response) y su ruta
  _lib.mjs              Utilidades, validaciones, stands por defecto, elección de almacenamiento
  _filestore.mjs        Almacenamiento en archivos JSON (modo servidor propio)
  register / login / me / stands / vote / admin .mjs
server/server.mjs       Servidor Node independiente (para correr fuera de Netlify)
netlify.toml            Config de Netlify
.env.example            Variables de entorno
docs/                   Afiche promocional
```

## Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `ADMIN_PIN` | siempre | PIN del panel `/admin`. Sin ella el panel responde 503. |
| `STORAGE_DIR` | servidor propio | Carpeta de datos (JSON). Si está definida se usa disco en vez de Netlify Blobs. Por defecto `./data` al usar `npm start`. |
| `PORT` | servidor propio | Puerto HTTP (por defecto 8080). |

## Opción A · Servidor propio (Node)

```bash
npm install
```
```bash
ADMIN_PIN=un-pin-seguro PORT=8080 npm start
```

Abre `http://localhost:8080`. Los datos quedan en `./data/` (un archivo JSON por participante, más `stands.json`, `config.json`, `raffle.json`).

Para producción:
- Ponerlo detrás de **HTTPS** (Nginx, Caddy, etc.). La **cámara del celular solo funciona con HTTPS**.
- Mantenerlo vivo con un gestor de procesos (pm2, systemd o Docker).
- Respaldar la carpeta `data/`.
- El almacenamiento en disco está pensado para **una sola instancia**. Si se escala a varias, migrar a una base de datos (ver Mejoras).

Ejemplo de Nginx (reverse proxy):
```nginx
location / {
  proxy_pass http://127.0.0.1:8080;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## Opción B · Netlify

- Datos en **Netlify Blobs** (store `semilla`), se activa solo.
- Definir `ADMIN_PIN` en *Site configuration → Environment variables* y volver a publicar.
- Publicar con la CLI: `npx netlify-cli deploy --build --prod`, o conectar el repositorio desde la web de Netlify.
- ⚠ **No usar Netlify Drop** (arrastrar la carpeta): sube solo el front y la API no funciona.
- Desarrollo local con Netlify: `npm run dev` (PIN local por defecto: `semilla2026`).

## API

Todas responden JSON. Autenticación del participante: header `Authorization: Bearer <celular>:<token>` (el token llega al registrarse o al entrar).

| Método | Ruta | Auth | Cuerpo / parámetros | Respuesta |
|---|---|---|---|---|
| POST | `/api/register` | — | `{name, phone, consent:true}` | `{user:{name,phone,token}, existing}` |
| POST | `/api/login` | — | `{phone}` | `{user}` · 404 si no existe |
| GET | `/api/stands` | — | — | `{stands, config}` |
| GET | `/api/me` | participante | — | `{user, votes, count, config}` |
| POST | `/api/vote` | participante | `{standId, stars:1-5, tags?:[≤2]}` | `{votes, count, minForRaffle}` |
| GET | `/api/admin?action=summary` | `x-admin-pin` | — | estadísticas, ranking, elegibles, sorteo |
| GET | `/api/admin?action=export` | `x-admin-pin` | — | CSV |
| POST | `/api/admin?action=stands` | `x-admin-pin` | `{stands:[{id?,name,team,pitch}]}` | reemplaza la lista |
| POST | `/api/admin?action=config` | `x-admin-pin` | `{votingOpen?, minForRaffle?}` | config |
| POST | `/api/admin?action=draw` | `x-admin-pin` | — | ganador al azar entre elegibles |
| POST | `/api/admin?action=resetRaffle` | `x-admin-pin` | — | vacía ganadores |
| POST | `/api/admin?action=deleteUser` | `x-admin-pin` | `{phone}` | borra participante y sus votos |

Validaciones del servidor: celular peruano `^9\d{8}$` (acepta prefijo 51), nombre con apellido, nota 1–5, tags de una lista fija, votación abierta. Hay límite simple de intentos por IP (en memoria).

## Datos

| Clave | Contenido |
|---|---|
| `users/<celular>` | `{name, phone, token, createdAt}` |
| `votes/<celular>` | `{ <standId>: {stars, tags, at} }` (un documento por persona: sin choques de escritura) |
| `stands` | lista de stands (si no existe se usan los de ejemplo de `_lib.mjs`) |
| `config` | `{votingOpen, minForRaffle}` |
| `raffle` | `{winners:[…]}` |

**Borrar datos de prueba antes del evento**
- Uno por uno: `POST /api/admin?action=deleteUser` con `{phone}`.
- Todo (servidor propio): detener el servidor y vaciar `data/`, dejando `stands.json` si ya se cargaron los reales.
- Todo (Netlify): `npx netlify-cli blobs:list semilla` y `blobs:delete semilla <clave>` para las claves `users/` y `votes/`.

## Probado (26/10/2026)

En producción (Netlify) y en el servidor propio: portada, entrada por QR, registro, reingreso por celular, validaciones (nombre, celular, nota, sesión inválida), 5 votos con etiquetas, elegible al sorteo, panel con PIN correcto e incorrecto, cerrar votación (bloquea votos), sorteo, exportación CSV y borrado de participante.

## Mejoras sugeridas para optimizar

1. **Ingreso solo con celular** (pedido de negocio): quien sepa el celular de otro puede entrar como él. Opciones: código por SMS/WhatsApp, o pedir además DNI/código de colaborador.
2. **Tokens sin vencimiento**: agregar expiración o rotación.
3. **Ranking**: el resumen lee todos los votos en cada consulta. Correcto para ~300 personas; para miles, usar una base de datos (Postgres/SQLite) con agregados.
4. **Límite de intentos en memoria**: se reinicia por instancia. En producción mover a Redis o al proxy (Nginx `limit_req`).
5. **Almacenamiento en disco**: una sola instancia. Para alta disponibilidad, cambiar `_filestore.mjs` por un adaptador a base de datos con la misma interfaz (`get`, `setJSON`, `delete`, `list`).
6. **Fuentes desde Google Fonts** (Archivo Black, JetBrains Mono): si la red del evento es limitada, descargarlas y servirlas desde `public/`.
7. **Pruebas automáticas**: no hay suite de tests; el flujo de la sección "Probado" es un buen guion para automatizar (por ejemplo con Playwright).
8. **Snacks desbloqueables**: diseñado (Figma "v3 · Snacks"), pendiente de programar.
