# Semilla Lab · Guía técnica

Votación del público por stands para Semilla Lab (Camposol). Para el uso funcional ver **[MANUAL.md](MANUAL.md)**.

- Producción actual: https://alonsom22.sg-host.com (SiteGround, proyecto Node.js con `npm start`; datos en `STORAGE_DIR`). La versión anterior en Netlify (`semilla-lab-camposol`) queda fuera de uso.
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
  staff/                Canje de premios para el staff de los puestos (index.html + staff.js)
  assets/               Sellos Semilla Lab y Camposol, favicon, fonts/ (Poppins) y prizes/ (fotos de los premios)
netlify/functions/      Back (API). Cada archivo exporta un handler (Request → Response) y su ruta
  _lib.mjs              Utilidades, validaciones, stands por defecto, elección de almacenamiento
  _filestore.mjs        Almacenamiento en archivos JSON (modo servidor propio)
  register / login / me / stands / vote / admin / staff .mjs
server/server.mjs       Servidor Node independiente (para correr fuera de Netlify)
tools/loadtest.mjs      Prueba de carga (simula N personas votando + staff + panel)
netlify.toml            Config de Netlify
.env.example            Variables de entorno
docs/                   Afiche, PRUEBA-DE-CARGA.md (300 personas) y marca/ (logos originales)
```

## Línea gráfica (Semilla Lab 2026)

Alineada con las piezas de campaña ("Trabajamos el campo para mejorar vidas"): banner, afiches, categorías y protector de pantalla.

| Token | Hex | Uso |
|---|---|---|
| Petróleo `--teal` | `#027D78` | Barra superior, portada, títulos |
| Verde `--green` / `--green-dark` | `#1CAF58` / `#128A43` | Colinas / botones (el oscuro cumple contraste AA con blanco) |
| Verde Camposol `--cs-green` | `#62A70F` | Colinas, sello Camposol |
| Lima `--cs-lime` | `#E6F079` | Sello Semilla Lab, acentos |
| Crema `--cream` / `--cream-soft` | `#FCFAB5` / `#FFFDE8` | Titulares sobre petróleo / fondo general |
| Menta `--mint` | `#C6EADE` | Fondos suaves |
| Naranja `--orange` | `#FC843C` | Acento de acción |

- **Tipografía:** Poppins (400–800), servida desde `public/assets/fonts/`.
- **Logos:** `public/assets/semilla-bulb.webp` (foquito del sello oficial sobre fondo lima, sin texto; barra superior, franja final y entrada por QR), `camposol-white.webp` (logo horizontal blanco, sobre fondos oscuros) y `camposol-badge.webp` (sello, sobre fondos claros como la proyección). `semilla-badge.webp` es el sello completo. Originales en `docs/marca/`.
- **Elementos:** colinas verdes (`hills()` en `app.js`), mosaicos de esquina y brote (símbolos SVG en `index.html`), franja final con ambos sellos.
- **Colores por stand y por premio:** `public/palette.js`. Cada color tiene `hex` (fondo), `fg` (texto sobre ese fondo) e `ink` (versión legible sobre blanco). Todas las combinaciones tienen contraste ≥ 4.4:1.
- **Caché:** imágenes y fuentes se guardan 7 días en el celular. Si se reemplaza una imagen, **usar un nombre de archivo nuevo**.

## Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `ADMIN_PIN` | siempre | PIN del panel `/admin`. Sin ella el panel responde 503. También entra a `/staff` (y puede deshacer canjes). |
| `STAFF_PIN` | siempre | PIN de la página de canje `/staff` para los puestos. Solo busca y marca entregas. |
| `STORAGE_DIR` | servidor propio | Carpeta de datos (JSON). Si está definida se usa disco en vez de Netlify Blobs. Por defecto `./data` al usar `npm start`. |
| `PORT` | servidor propio | Puerto HTTP (por defecto 8080). |

## Opción A · Servidor propio (Node)

```bash
npm install
```
```bash
ADMIN_PIN=un-pin-seguro STAFF_PIN=otro-pin PORT=8080 npm start
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
- Definir `ADMIN_PIN` y `STAFF_PIN` en *Site configuration → Environment variables* y volver a publicar.
- Publicar con la CLI: `npx netlify-cli deploy --build --prod`, o conectar el repositorio desde la web de Netlify.
- ⚠ **No usar Netlify Drop** (arrastrar la carpeta): sube solo el front y la API no funciona.
- Desarrollo local con Netlify: `npm run dev` (PINs locales por defecto: admin `semilla2026`, staff `staff2026`).

## API

Todas responden JSON. Autenticación del participante: header `Authorization: Bearer <celular>:<token>` (el token llega al registrarse o al entrar).

| Método | Ruta | Auth | Cuerpo / parámetros | Respuesta |
|---|---|---|---|---|
| POST | `/api/register` | — | `{name, phone, consent:true}` | `{user:{name,phone,token}, existing}` |
| POST | `/api/login` | — | `{phone}` | `{user}` · 404 si no existe |
| GET | `/api/stands` | — | — | `{stands, config, prizes}` (niveles de premios) |
| GET | `/api/me` | participante | — | `{user, votes, count, config, prizes}` (estado de cada premio) |
| POST | `/api/vote` | participante | `{standId, stars:1-5, tags?:[≤2], comment?:≤280}` | `{votes, count, minForRaffle, prizes}` |
| GET | `/api/staff?action=search&q=&prize=` | `x-staff-pin` | `q` nombre o dígitos del cel; sin `q` lista quienes tienen premios pendientes (filtrable por `prize`) | `{role, prizes, total, people}` |
| POST | `/api/staff?action=claim` | `x-staff-pin` | `{id, prize}` | marca entregado · 409 si ya canjeó (`alreadyClaimed`, `claimedAt`) o si aún no lo desbloquea |
| POST | `/api/staff?action=unclaim` | `x-staff-pin` (solo admin) | `{id, prize}` | deshace un canje |
| GET | `/api/admin?action=summary` | `x-admin-pin` | — | estadísticas, ranking, premios, quienes completaron 10 |
| GET | `/api/admin?action=export` | `x-admin-pin` | — | CSV |
| POST | `/api/admin?action=stands` | `x-admin-pin` | `{stands:[{id?,name,team,pitch}]}` | reemplaza la lista |
| POST | `/api/admin?action=config` | `x-admin-pin` | `{votingOpen?, minForRaffle?}` | config |
| POST | `/api/admin?action=draw` | `x-admin-pin` | — | ganador al azar entre elegibles |
| POST | `/api/admin?action=resetRaffle` | `x-admin-pin` | — | vacía ganadores |
| POST | `/api/admin?action=deleteUser` | `x-admin-pin` | `{phone}` | borra participante y sus votos |

Validaciones del servidor: celular peruano `^9\d{8}$` (acepta prefijo 51), nombre con apellido, nota 1–5, tags de una lista fija, votación abierta.

Límite de intentos (en memoria, por instancia): votos 40/min **por persona**; registro e ingreso 600/min por IP (alto a propósito: en el evento cientos de personas comparten la IP del WiFi).

Caché: el resumen del panel y el padrón del staff se calculan como máximo cada 15 s y se comparten entre instancias (documentos `cache/summary` y `cache/roster`). Un canje actualiza el padrón al instante; cambios de stands, configuración, sorteo o borrado de personas lo invalidan.

## Datos

| Clave | Contenido |
|---|---|
| `users/<celular>` | `{name, phone, token, createdAt}` |
| `votes/<celular>` | `{ <standId>: {stars, tags, comment?, at} }` (un documento por persona: sin choques de escritura) |
| `claims/<celular>` | `{ <premio>: {at, by} }` premios entregados (`by` = staff o admin) |
| `stands` | lista de stands `{id, name, team, pitch}`; `team` es la categoría (si no existe se usan los 10 finalistas de `_lib.mjs`) |
| `config` | `{votingOpen, minForRaffle}` |
| `raffle` | `{winners:[…]}` |

**Borrar datos de prueba antes del evento**
- Uno por uno: `POST /api/admin?action=deleteUser` con `{phone}`.
- Todo (servidor propio): detener el servidor y vaciar `data/`, dejando `stands.json` si ya se cargaron los reales.
- Todo (Netlify): `npx netlify-cli blobs:list semilla` y `blobs:delete semilla <clave>` para las claves `users/`, `votes/` y `claims/`.

**Premios.** Los niveles están en `PRIZES` dentro de `netlify/functions/_lib.mjs` (3 canchita · 5 gaseosa · 8 helado · 10 hot dog; el último nivel es la meta "completaron 10", igual al número de stands). Para cambiar un nivel o agregar un premio, editar `PRIZES` y agregar su color e imagen en `PRIZE_STYLE` (`public/palette.js`) y `public/assets/prizes/`.

## Probado (27/10/2026)

En producción (Netlify) y en el servidor propio: portada, entrada por QR, registro, reingreso por celular, validaciones (nombre, celular, nota, sesión inválida), votos con etiquetas, desbloqueo de premios en 4 y 16 stands (último premio: hot dog), vale que se actualiza solo al ser canjeado, búsqueda del staff (sin tildes y por dígitos), entrega, bloqueo de doble canje, no se entrega lo no desbloqueado, deshacer solo admin, panel con PIN correcto e incorrecto, estadísticas de premios, cerrar votación (bloquea votos), exportación CSV y borrado de participante (incluye sus canjes).

## Mejoras sugeridas para optimizar

1. **Ingreso solo con celular** (pedido de negocio): quien sepa el celular de otro puede entrar como él. Opciones: código por SMS/WhatsApp, o pedir además DNI/código de colaborador.
2. **Tokens sin vencimiento**: agregar expiración o rotación.
3. **Ranking**: se recalcula como máximo cada 15 s leyendo todos los votos. Probado con 300 personas; para miles, usar una base de datos (Postgres/SQLite) con agregados.
4. **Límite de intentos en memoria**: se reinicia por instancia. En producción mover a Redis o al proxy (Nginx `limit_req`, cuidando que el WiFi del evento comparte IP).
5. **Almacenamiento en disco**: una sola instancia. Para alta disponibilidad, cambiar `_filestore.mjs` por un adaptador a base de datos con la misma interfaz (`get`, `setJSON`, `delete`, `list`).
6. **Protección anti-bots de Netlify por IP**: ver `docs/PRUEBA-DE-CARGA.md`. Con todo el evento en un WiFi de una sola IP hay riesgo de bloqueo temporal; en servidor propio no aplica.
7. **Pruebas automáticas**: no hay suite de tests funcionales; el flujo de la sección "Probado" es un buen guion para automatizar (por ejemplo con Playwright). Para carga, usar `tools/loadtest.mjs`.
8. **Canje simultáneo**: si dos celulares del staff marcan el mismo premio de la misma persona en el mismo segundo, ambos podrían registrarse (último gana, sin duplicar el premio en los datos). Con un puesto por premio el riesgo es mínimo; con base de datos se resuelve con una restricción única.
9. **Búsqueda del staff**: usa el padrón compartido (15 s) y luego lee frescos solo los datos de las coincidencias. Para miles de personas, indexar en base de datos.
