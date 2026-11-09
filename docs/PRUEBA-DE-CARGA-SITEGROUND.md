# Prueba de carga · SiteGround · 800 personas

Fecha: 09/11/2026 · Script: `tools/loadtest.mjs` · Resultados crudos: `docs/loadtest-sg-*.json`

## Arquitectura probada

```
Celular ──(página: HTML/JS/CSS)──▶ semilla-lab-camposol.netlify.app ──proxy 200──▶ SiteGround
   └──────(API: votos, vales, staff, admin)───────────────────────────────────────▶ SiteGround (CORS)
```

- La URL de los QR impresos (`semilla-lab-camposol.netlify.app`) no cambia: Netlify entrega la página haciendo de proxy.
- La API va **directo** a `alonsom22.sg-host.com` (`API_BASE` en `public/app.js`, `staff.js` y `admin.js`; CORS en `server/server.mjs`). Así el tráfico pesado no pasa por Netlify: ni su bloqueo anti-bots por IP (~10 solicitudes/s) ni su consumo de créditos.
- Servidor: Node 22 en SiteGround, un proceso, datos en JSON (`STORAGE_DIR`).

Todas las personas simuladas salen **desde una misma IP**, igual que en el WiFi del evento.

## Resultados

| | T1 · Evento | T2 · Estrés | T3 · Por Netlify |
|---|---|---|---|
| Escenario | 800 personas llegan en 20 min, 20–60 s entre stands | 800 personas en 2 min, 1–4 s entre stands | 60 personas; páginas por netlify.app, API directa |
| Solicitudes | 39.341 en 29 min | 30.691 en 4 min | 3.399 en 14 min |
| Ritmo | 23/s promedio · **30–39/s sostenido** · pico 82/s | 133/s promedio · pico 259/s | 4/s · páginas por Netlify 1,2/s |
| Errores | **0** | **0** | **0** |
| Voto (mediana · p95) | 142 · 152 ms | 134 · 153 ms | 146 · 515 ms |
| 800 votos en el mismo instante | 3,8 s | 1,7 s | — |
| Canjes · dobles seguidos bloqueados | 842 · 136/136 | 91 · 19/19 | 228 · 41/41 |
| Dobles canjes **simultáneos** (dos puestos a la vez) | 75 · **0 aceptados dos veces** | 10 · 0 | 18 · 0 |
| Personas con número de canje | 800/800 en los 4 premios | 800/800 | 60/60 |
| Cierre de votación | Rechaza votos (403) y muestra al primero | Igual | — |
| Datos consistentes | 8.000/8.000 votos | 8.000/8.000 | 600/600 |

Unos 135 ms de cada respuesta son la distancia de red hasta el servidor; el servidor mismo responde en milisegundos.

**T1 sostuvo 30–39 solicitudes/s durante 20 minutos.** Si todo pasara por Netlify (proxy completo), ese ritmo desde una misma IP habría activado su bloqueo (~10/s). Con la API directa, a Netlify solo le llega la carga de páginas: 1,2/s en T3 y unas 7/s incluso en T1, que comprime en 20 minutos lo que en el evento real se reparte en 5–6 horas.

### T5 · Reinicio en vivo

150 personas votando (13:23–13:30) y, a las 13:25, "Guardar y desplegar" en SiteGround (reinicia la app):

- El ritmo nunca cayó a cero (21–27 solicitudes/s en ese tramo): el corte duró menos de 10 s.
- **6 de 6.618 solicitudes (0,09 %)** perdieron la conexión en ese momento: 1 voto, 2 consultas del vale y 3 archivos JS/CSS. En el celular, la app reintenta sola (a los 1,5 s); el script de prueba no reintenta.
- **No se perdió ningún dato**: 153/153 registros y todos los votos confirmados quedaron guardados.

## Problemas encontrados y corregidos

1. **Doble canje simultáneo.** Si dos puestos canjeaban a la misma persona en el mismo instante, ambos podían entregar. Antes solo se habían probado dobles canjes uno después del otro. Ahora el canje, el voto y la asignación de números se procesan uno tras otro por persona (`withLock` en `netlify/functions/_lib.mjs`). Resultado: 103 intentos simultáneos, 0 entregados dos veces.
2. **Escrituras que chocaban.** Dos escrituras del mismo archivo en el mismo milisegundo usaban el mismo archivo temporal y una fallaba con error 500. Ahora el nombre temporal es único (`_filestore.mjs`).
3. **Números de canje insuficientes.** El máximo era 500 por premio: desde la persona 501, nadie recibía número. Ahora es 1.000 y las hojas salen en 2 A4 por premio (1–500 y 501–1.000).

## Observaciones

- **1 respuesta de la API sin cabecera CORS** en T3 y otra en T5, entre unas 82.000 llamadas. No se repitió en 2.000 llamadas dirigidas. En el celular, la app reintenta sola cualquier pedido que falle (a los 1,5, 4 y 9 s), así que no llegaría a verse.
- Durante T2 una persona real se registró desde la web ("Luciana caballero"); por eso hubo un registro de más. No es un error.

## Para el día del evento

- **No subir nada a `main`** durante la votación: SiteGround redespliega y reinicia la app.
- Igual conviene que el WiFi tenga varias IPs públicas o invitar a usar datos móviles, aunque el riesgo de Netlify ahora es bajo.
- Pedir que escaneen con el botón **QUIERO VOTAR** de la app: no recarga la página, así que no pasa por Netlify.
- Imprimir las hojas 1–1.000 desde `/admin` → Hojas de canje.
- Antes de abrir, dejar los datos en cero: vaciar `semilla-data` en SiteGround (incluye "Carlos corpus" y "Luciana caballero", que son de prueba).
- Plan B si SiteGround falla: en Netlify → Deploys → publicar el deploy del Nov 8, 12:44 PM. Es la app completa en Netlify, sin costo, pero con su propia base de datos.

## Cómo repetir

```bash
# Evento (≈30 min) contra SiteGround, con Origin de Netlify para validar CORS
API_BASE=https://alonsom22.sg-host.com ORIGIN=https://semilla-lab-camposol.netlify.app \
USERS=800 PROFILE=evento ADMIN_PIN=... STAFF_PIN=... node tools/loadtest.mjs

# Estrés (≈4 min)
API_BASE=https://alonsom22.sg-host.com ORIGIN=https://semilla-lab-camposol.netlify.app \
USERS=800 PROFILE=estres ADMIN_PIN=... STAFF_PIN=... node tools/loadtest.mjs
```

El script borra sus participantes de prueba al terminar (`CLEANUP=1`) y reabre la votación si la cerró. **No correrlo durante el evento ni con estrés contra netlify.app.**
