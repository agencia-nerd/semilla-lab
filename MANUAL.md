# Semilla Lab · Manual de uso

**Cultiva tu idea. Cosecha innovación.**
App web para que el público de Semilla Lab (Camposol) recorra los stands, califique las ideas y participe en el sorteo. El jurado elige al ganador oficial; esta app le da voz al público.

- App: https://semilla-lab-camposol.netlify.app
- Panel de administración: https://semilla-lab-camposol.netlify.app/admin (el PIN se comparte por separado)
- Probar la entrada por QR sin tener el QR impreso: https://semilla-lab-camposol.netlify.app/?stand=s03

Funciona en cualquier celular con navegador. No se instala nada.

---

## 1. Cómo funciona para el participante

### 1.1 Entrada
Hay dos formas de entrar:

| Entrada | Qué pasa |
|---|---|
| **QR del tótem de registro** (abre la portada) | Ve la frase "Cultiva tu idea. Cosecha innovación." y el botón **QUIERO VOTAR**. |
| **QR de un stand** (`/?stand=ID`) | Ve **3 segundos** de entrada animada con la frase y el número del stand (STAND—03) en su color, y pasa sola a la votación de ese stand. Si toca la pantalla, se salta la espera. |

### 1.2 Registro (una sola vez)
- Nombre y apellido + celular (9 dígitos, empieza con 9) + casilla de autorización de datos.
- Si entró por el QR de un stand, al terminar el registro vuelve directo a votar ese stand.
- Si el celular ya estaba registrado, simplemente entra.

### 1.3 Volver a entrar
- La sesión queda guardada en el navegador del celular.
- Si se cierra o cambia de celular: **YA ME REGISTRÉ** → escribe solo su celular → entra con sus votos intactos.

### 1.4 Mi cosecha (pantalla principal)
- **QUIERO VOTAR**: abre la cámara para escanear el QR de un stand.
- **Tu cosecha**: contador `03/05` con barras; indica cuánto falta para el sorteo.
- **Stands**: cuadrícula con cada stand en su color y su número grande. Se puede **tocar cualquier stand** para votar (el QR es un atajo, no un requisito). Los stands ya votados aparecen rellenos con su nota.

### 1.5 Votar
1. Elegir la nota del **1 al 5** (1 = puede crecer · 5 = lista para cosechar).
2. Opcional: **"Lo más fuerte"**, hasta 2 opciones (Impacto, Ahorro de tiempo, Fácil de aplicar, Original, Cuida a las personas, Sostenible).
3. **VOTAR**.

Se puede cambiar el voto de un stand mientras la votación esté abierta (queda el último).

### 1.6 Después de votar
- Pantalla **+1 · VOTO SEMBRADO** con el contador actualizado.
- Botón al siguiente stand pendiente, o escanear otro QR.
- Al llegar a **5 stands** votados: pantalla **ESTÁS EN EL SORTEO** con ticket confirmado.

---

## 2. Panel de administración (`/admin`)

Entrar con el PIN. Cuatro pestañas:

### Resultados
- Registrados · ya votaron · votos totales · en sorteo.
- **Cerrar / abrir votación**: al cerrarla nadie puede votar ni cambiar su voto.
- **Proyectar**: vista a pantalla completa con la frase y el ranking en vivo (se actualiza cada 10 s), para la pantalla del evento.
- **Exportar CSV**: participantes, celular, fecha, cuántos stands votó, si está en sorteo y la nota de cada stand.
- **Ranking del público**: ordenado por promedio, desempate por cantidad de votos. Un stand necesita **mínimo 3 votos** para competir en el ranking (con menos queda al final). Muestra también lo que el público marcó como "lo más fuerte".

### Stands
- Editar nombre, equipo y la idea en una línea; agregar, eliminar y reordenar.
- **El orden define el número y el color** de cada stand (01 Verde Camposol, 02 Arándano, 03 Mandarina, 04 Sol, 05 Uva, 06 Riego, 07 Lima, 08 Palta, 09 Langostino, 10 Tierra; luego se repite).
- Cambiar el nombre no afecta los votos. Eliminar un stand oculta sus votos.
- ⚠ Los stands actuales son **de ejemplo**: cargar los reales antes de imprimir los QR.

### Códigos QR
- Genera un afiche por stand (color + número gigante + QR) y un QR de ingreso general.
- **Imprimir QRs** → hoja lista para imprimir (2 por página).
- Los QR apuntan al dominio desde el que se abre el panel: imprimirlos desde el dominio final.

### Sorteo
- Participan quienes votaron **5 o más stands**.
- **Sortear**: animación tipo ruleta y muestra el ganador con su celular enmascarado; el celular completo queda en la lista de ganadores para contactarlo.
- Se pueden sortear varios ganadores (no se repiten). **Reiniciar sorteo** borra la lista de ganadores.

---

## 3. Checklist del día del evento

1. Cargar los **stands reales** en el panel (pestaña Stands) y revisar el orden/colores.
2. **Borrar los datos de prueba** (ver README › Datos).
3. Imprimir los **QR de cada stand** y el **QR de ingreso** para el tótem.
4. Probar con 2–3 celulares: registro → escanear QR → votar → ver el contador.
5. Abrir **Proyectar** en la pantalla del evento.
6. Al cierre: **Cerrar votación** → **Exportar CSV** → **Sorteo**.

---

## 4. Preguntas frecuentes

**¿Puede alguien votar dos veces el mismo stand?** No. Cada celular tiene un voto por stand; votar de nuevo lo reemplaza.

**¿Necesitan internet?** Sí, datos o WiFi. La app es liviana (sin instalar nada).

**¿La cámara no abre?** Pueden escanear el QR con la cámara normal del celular, o tocar el stand en la lista.

**¿Qué pasa si alguien pone el celular de otra persona?** El ingreso es solo con celular (pedido del cliente para simplificar). En un evento interno el riesgo es bajo; ver README › Mejoras sugeridas.

---

## 5. En diseño (aún no programado)

**Snacks desbloqueables** (aprobado como idea con el cliente, diseño en Figma página "v3 · Snacks"; afiche en `docs/afiche-snacks.png`):
03 stands = chicha · 05 = canchita · 08 = helado · 12 = picarones. Canje en el puesto: el staff mantiene presionado 2 s en el celular del asistente. Requiere al menos 12 stands.
