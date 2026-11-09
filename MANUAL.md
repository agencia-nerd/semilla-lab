# SemillaLab · Manual de uso

**Cultiva tu idea. Cosecha innovación.**
App web para que el público de SemillaLab (Camposol) recorra los stands, califique las ideas y gane premios mientras más vote. El jurado elige al ganador oficial; esta app le da voz al público.

- App: https://semilla-lab-camposol.netlify.app
- Panel de administración: https://semilla-lab-camposol.netlify.app/admin (PIN de admin, se comparte por separado)
- Canje de premios (staff de los puestos): https://semilla-lab-camposol.netlify.app/staff (PIN de staff, se comparte por separado)
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
- Nombre y apellido + **código de trabajador** + casilla de autorización de datos. No se pide celular.
- El código de trabajador identifica a la persona: cada código es una sola persona.
- Si entró por el QR de un stand, al terminar el registro vuelve directo a votar ese stand.
- Si el código ya estaba registrado, entra directo con sus votos.

### 1.3 Volver a entrar
- La sesión queda guardada en el navegador del celular.
- Si se cierra o cambia de celular: **YA ME REGISTRÉ** → escribe su **código de trabajador** → entra con sus votos intactos.

### 1.4 Mi cosecha (pantalla principal)
- **QUIERO VOTAR**: abre la cámara para escanear el QR de un stand.
- **Tu cosecha**: contador `06/10` con barras; indica cuánto falta para el próximo premio.
- **Premios**: 4 tarjetas (canchita, gaseosa, helado, hot dog). Bloqueada = gris con "Faltan NN"; lista = en color con "Ver vale →"; canjeada = gris con ✓ y la hora.
- **Mis votos**: al inicio está vacío. Los stands **no se listan**: se descubren escaneando el QR de cada stand. Cada stand votado aparece aquí, agrupado por categoría y con su nota; tocándolo se puede cambiar el voto.

### 1.5 Votar
1. Elegir la nota del **1 al 5** (1 = puede crecer · 5 = lista para cosechar).
2. Opcional: **"Lo más fuerte"**, hasta 2 opciones (Impacto, Ahorro de tiempo, Fácil de aplicar, Original, Cuida a las personas, Sostenible).
3. **VOTAR**.

Se puede cambiar el voto de un stand mientras la votación esté abierta (queda el último).

### 1.6 Después de votar
- Pantalla **+1 · VOTO SEMBRADO** con el contador actualizado y cuánto falta para el próximo premio.
- Si con ese voto llegó a un nivel: pantalla **DESBLOQUEASTE** con el premio y el botón **VER MI VALE**.
- Botón al siguiente stand pendiente, o escanear otro QR.

### 1.7 Premios (a los 3, 5, 8 y 10 stands)

| Stands votados | Premio | Vale |
|---|---|---|
| 3 | Canchita | 1 unidad |
| 5 | Gaseosa | 1 unidad |
| 8 | Helado | 1 unidad |
| 10 | Hot Dog | 1 unidad (último premio: todos los stands) |

- Se **acumulan**: quien vota 5 tiene canchita y gaseosa. Cada premio se canjea **una sola vez**.
- **El vale está en la app**: la persona abre el premio y muestra su pantalla en el puesto. Cuando el staff lo marca, el vale cambia solo a **✓ CANJEADO** con la hora.
- **Número de canje**: cada vale muestra en grande un número al azar del 1 al 1.000, distinto para cada premio y que nunca se repite entre personas. Es el que se tacha en la hoja impresa del puesto (ver 3.1).

---

## 2. Panel de administración (`/admin`)

Entrar con el PIN. Tres pestañas:

### Resultados
- Registrados · ya votaron · votos totales · completaron 10 (todos los premios).
- **Cierre de votación**: al activarlo nadie puede votar ni cambiar su voto, y aparece en pantalla el **Favorito del público** (el primer puesto, con su promedio, votos y notas 5). Si hay empate total en el primer puesto, muestra a todos los empatados. Después se puede volver a ver con **Ver ganador**, o **Reabrir votación**.
- **Proyectar**: vista a pantalla completa con la frase y el ranking en vivo (se actualiza cada 30 s), para la pantalla del evento.
- **Exportar CSV**: participantes, celular, fecha, cuántos stands votó, si completó los 10, el estado de cada premio, y la nota de cada stand.
- **Favorito del público** (ranking en vivo). Reglas, en este orden:
  0. Compiten los stands con **al menos 3 votos** (con menos quedan al final, sin puesto).
  1. Mayor **promedio** de votos.
  2. Si empatan: mayor **cantidad de votos** totales.
  3. Si siguen empatados: más votos con **nota 5**.
  4. Si siguen empatados: más votos con **nota 4**.
  - Solo si dos stands son idénticos en todo comparten el puesto (aparece "empate"). Las reglas se muestran en el panel, sobre el ranking. También muestra lo que el público marcó como "lo más fuerte".

### Stands
- Editar nombre, **categoría** y la idea en una línea; agregar, eliminar y reordenar.
- **El orden define el número** de cada stand y **la categoría define el color**: los stands de una misma categoría comparten color y en la app aparecen agrupados bajo su categoría (1 naranja, 2A verde, 2B verde bosque, 3 morado). Sin categoría, el color va por posición (01 Petróleo, 02 Verde, 03 Naranja, 04 Lima, 05 Camposol, 06 Sol, 07 Celeste, 08 Bosque, 09 Coral, 10 Tierra; luego se repite).
- Cambiar el nombre no afecta los votos. Eliminar un stand oculta sus votos.
- Son los **10 finalistas** de SemillaLab 2026 (la categoría se muestra en la tarjeta y en la ficha de cada stand):
  - **Cat. 1 · Crecimiento comercial y experiencia del cliente** (verde): 01 Coti AI · 02 Inventory Value Optimization.
  - **Cat. 3 · Excelencia productiva y calidad** (crema): 03 Eureka · 04 Avocado Rewash.
  - **Cat. 2 · Eficiencia y sostenibilidad** (petróleo): 05 Handpack Evolution · 06 Geocampos IA · 07 Hydratech · 08 Mr. Pack · 09 Smart Track IOT · 10 Protime.
- El color va por el número de categoría escrito al inicio ("Cat. 1", "Cat. 2", "Cat. 3"): 1 verde, 2 petróleo, 3 crema.
- Las descripciones cortas son una propuesta a partir del nombre: conviene validarlas con cada equipo. Para que todos los premios sean alcanzables debe haber **al menos 10 stands**.

### Códigos QR
- **QR de la web** destacado arriba, con la dirección y el botón **Descargar PNG** (alta resolución, para el tótem de registro, afiches o pantallas).
- Un afiche por stand (color + número gigante + QR + categoría).
- **Imprimir QRs** → hoja lista para imprimir (2 por página).
- Los QR apuntan al dominio desde el que se abre el panel: imprimirlos desde el dominio final.

### Premios (en Resultados)
- Por cada premio: cuántos se **canjearon** sobre cuántos se **desbloquearon**, y cuántos quedan **pendientes** (sirve para calcular el stock de cada puesto).
- Botón **Canje premios →** abre la página del staff.
- El CSV incluye una columna por premio: `pendiente` o `canjeado <fecha>`.

---

## 3. Canje de premios para el staff (`/staff`)

Para los encargados de cada puesto (canchita, gaseosa, helado, hot dog) y sus asistentes. Funciona en el celular. Se entra con el **PIN de staff**, que solo da acceso al canje: no muestra resultados ni permite editar nada.

1. **Mi puesto**: elegir el premio que entrega ese puesto (queda guardado en ese celular). Con "Todos" se ven todos los premios.
2. **Buscar**: por nombre (no importan tildes ni mayúsculas, por ejemplo "alvaro pena") por código de trabajador o por el número del vale. Sin buscar, la lista muestra a quienes tienen ese premio pendiente.
3. Cada persona muestra sus 4 premios: **gris** = aún no lo desbloquea (muestra cuántos stands le faltan), **color "Entregar"** = listo, **petróleo ✓ hora** = ya lo recibió.
4. **Entregar** → confirmar → queda registrado con la hora. El vale del participante se actualiza solo.
5. Si la persona vuelve a pedir el mismo premio, aparece **"YA CANJEÓ … a las HH:MM"** en rojo: cada premio se entrega una sola vez.
6. Si alguien se equivocó al marcar, el **admin** (entrando a `/staff` con el PIN de admin) puede usar **Deshacer canje**.

La lista se actualiza sola cada 30 segundos (al buscar un nombre, sus datos siempre se leen al momento).

---

### 3.1 Canje con hoja impresa (sin celular)

Para las personas que entregan los snacks y prefieren no usar el celular.

1. En el panel, pestaña **Hojas de canje** → **Imprimir las 4** (o "Solo Canchita", etc.). Salen 2 hojas A4 por premio (casillas del 1 al 500 y del 501 al 1.000); cada puesto recibe sus 2 hojas.
2. Cada puesto recibe **su** hoja (canchita, gaseosa, helado o hot dog).
3. La persona muestra su vale: tiene un **número grande**.
4. La señora busca ese número en su hoja:
   - **No está tachado** → lo tacha y entrega el snack.
   - **Ya está tachado** → ese vale ya se usó, no entregar.
5. Cada premio tiene números distintos: el 37 de canchita y el 37 de gaseosa son personas diferentes. Por eso cada puesto usa solo su hoja.

Las hojas y `/staff` se pueden usar a la vez: en `/staff` también se puede buscar por el número del vale. Si se usa solo la hoja, el panel no registra la entrega (la hoja es el registro).

En **Resultados › Premios** se ve cuántos números lleva asignados cada premio (máximo 1.000). Si se acerca a 1.000 aparece "⚠ casi agotados".

## 4. Checklist del día del evento

1. Cargar los **stands reales** en el panel (pestaña Stands, 10 finalistas) y revisar el orden/colores.
2. **Borrar los datos de prueba** (ver README › Datos).
3. Imprimir los **QR de cada stand**, el **QR de la web** (Descargar PNG) para el tótem y las **hojas de canje** de cada puesto.
4. Pasar el **PIN de staff** y el link `/staff` a cada puesto; que cada uno elija **Mi puesto**.
5. Probar con 2–3 celulares: registro → votar 3 stands → abrir el vale → canjear desde `/staff` → intentar canjear de nuevo (debe avisar "ya canjeó").
6. Abrir **Proyectar** en la pantalla del evento.
7. Al cierre: **Cerrar votación** → **Exportar CSV**.

---

## 5. Preguntas frecuentes

**¿Puede alguien votar dos veces el mismo stand?** No. Cada celular tiene un voto por stand; votar de nuevo lo reemplaza.

**¿Necesitan internet?** Sí, datos o WiFi. La app es liviana (sin instalar nada).

**¿La cámara no abre?** Pueden escanear el QR con la cámara normal del celular, o tocar el stand en la lista.

**¿Pueden canjear dos veces el mismo premio?** No. El servidor lo bloquea y el staff ve "YA CANJEÓ" con la hora.

**¿Qué pasa si alguien pone el código de otra persona?** Entraría como esa persona: el ingreso es solo con el código de trabajador (pedido del cliente). Para más seguridad, cargar la lista oficial de códigos o pedir un segundo dato.

---
