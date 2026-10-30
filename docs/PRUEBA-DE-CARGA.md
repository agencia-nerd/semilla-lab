# Prueba de carga · 300 personas a la vez

Fecha: 27/10/2026 · Script: `tools/loadtest.mjs` · Resultados crudos: `docs/loadtest-300*.json`

## Qué se simuló

300 personas que llegan en 1 minuto, se registran y votan los 16 stands con pausas de 2 a 8 s (≈20 veces más intenso que un evento real, donde la gente tarda horas en recorrer). En paralelo: la pantalla de proyección, el panel admin, 5 puestos de staff buscando y canjeando (con intentos de doble canje) y, al final, **300 votos en el mismo instante**. Todas las personas salieron desde una misma IP, como en el WiFi de un evento.

Se probó contra una **copia aislada** en Netlify (`semilla-lab-loadtest`, con su propia base de datos) y contra el **servidor propio** (Node, `npm start`). La app real no se tocó.

## Resultados

| | Netlify (copia) | Servidor propio |
|---|---|---|
| Registros | 300/300 | 300/300 |
| Votos aceptados | 3.624 de 4.800 (el resto: bloqueo anti-bots, ver abajo) | **4.800/4.800** |
| Pico de 300 votos simultáneos | **300/300 en 2,1 s** | **300/300 en 0,09 s** |
| Tiempo de respuesta de un voto (mediana · p95) | 0,5 s · 0,8 s | 0,003 s · 0,006 s |
| Canjes · dobles canjes bloqueados | 61 · 14 de 14* | 119 · 14 de 14 |
| Datos consistentes (nada perdido ni duplicado) | Sí | Sí |

\* En Netlify hubo 15 intentos de doble canje: 14 los rechazó el servidor y el otro lo cortó el bloqueo anti-bots antes de llegar. **Ningún premio se entregó dos veces.**

## Hallazgo principal: protección anti-bots de Netlify por IP

La app responde bien. El límite lo pone Netlify: al ver muchas solicitudes seguidas desde **una misma IP**, primero muestra una verificación ("We are verifying your connection") y, si sigue, **bloquea esa IP por 3–4 minutos para todos los sitios de Netlify**, incluida la app real.

Medido desde una sola IP:

| Ritmo sostenido | Resultado |
|---|---|
| 5 solicitudes/s durante 90 s | OK |
| 10 solicitudes/s durante 90 s | OK |
| 20 solicitudes/s | Verificación y luego bloqueo |
| ~100 solicitudes/s | Verificación a los ~17 s |

Netlify no publica el umbral exacto y puede variar. Tomar **~10 solicitudes/s por IP** como techo seguro.

**Tráfico estimado del evento real** (300 personas en ~2 h, ya con las optimizaciones): ≈100 solicitudes por persona → **≈4 solicitudes/s en promedio**, con picos de **8–10/s** si mucha gente vota a la vez y con varios vales abiertos. Está **dentro del margen, pero cerca del límite** si todos salen por la misma IP.

## Lo que se cambió a raíz de la prueba

1. **Límite de intentos por persona, no por IP.** Antes, con todos en el mismo WiFi, a partir del registro 31 en un minuto la app habría respondido "Demasiados intentos". Ahora los votos se limitan por persona y el registro e ingreso por IP con un margen para WiFi compartido.
2. **Resumen del panel y lista del staff compartidos 15 s.** Antes cada consulta leía a todos los participantes (~900 lecturas); ahora casi siempre es 1 lectura.
3. **Menos consultas automáticas.** Proyección cada 30 s (antes 10), panel cada 30 s (antes 15), staff cada 30 s (antes 20), vale abierto cada 8 s (antes 4).
4. **Caché en el celular.** Imágenes y fuentes se guardan 7 días y JS/CSS 5 minutos: escanear otro QR no vuelve a descargar todo.
5. **Fuentes servidas desde el propio sitio** (ya no dependen de Google Fonts).
6. **Reintento automático.** Si aparece la verificación de Netlify o falla la red, la app muestra "Mucha gente conectada. Reintentando…" y reintenta sola (2, 5 y 10 s).

## Recomendaciones para el evento

1. **Red del lugar (lo más importante).** Pedir a TI que el WiFi del evento salga por **varias IPs públicas**, o invitar a usar **datos móviles** (cada operador da IPs distintas). Si todos van por un solo WiFi con una IP, el riesgo de bloqueo existe.
2. **Escanear desde la app.** El botón QUIERO VOTAR abre el escáner dentro de la app y no recarga la página (menos solicitudes que usar la cámara del celular).
3. **Alternativa sin este riesgo: servidor propio.** El mismo código corre con `npm start` en su infraestructura, sin protección anti-bots de terceros. En la prueba respondió sin errores. Poner detrás de HTTPS (Nginx/Caddy).
4. **Si se mantiene Netlify:** consultar a soporte de Netlify si su plan permite ajustar o excluir la protección para una IP conocida (la del WiFi del evento).
5. **No correr pruebas de carga contra la app real**: un bloqueo de IP también afecta a quienes la estén revisando desde esa red.

## Cómo repetir la prueba

```bash
BASE=https://copia-de-prueba USERS=300 ADMIN_PIN=... STAFF_PIN=... node tools/loadtest.mjs
```

Variables: `RAMP` (segundos de llegada, 60), `THINK_MIN`/`THINK_MAX` (pausa entre votos, 2–8 s), `OUT` (archivo de resultados). **Escribe datos: usar siempre una copia.**
