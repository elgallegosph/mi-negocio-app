# Amare Beauty · App del negocio (versión 2)

App web para el día a día de la tienda. Se instala en el celular como una app y también funciona en el computador.

## Qué trae

| Sección | Para qué sirve |
|---|---|
| **Inicio** | Ventas y ganancia de hoy, estado de la caja, lo que te deben, alertas de stock y separados por entregar |
| **Vender** | Buscar productos, carrito con + y −, descuento, cliente por WhatsApp, contado / fiado / separado, cálculo de vueltas, recibo en PDF y por WhatsApp |
| **Inventario** | Productos (precio, costo, stock mínimo), entradas de mercancía con proveedor y costo promedio, ajustes con motivo, historial de movimientos (kárdex), conteo físico, importar/exportar Excel |
| **Caja** | Abrir con base, ingresos y retiros, gastos en efectivo, cuadre en vivo, cierre contando billetes y monedas, sobrante/faltante, historial de cierres y PDF |
| **Ventas** | Historial por día, filtros, detalle, reimprimir recibo, anular (devuelve el stock) |
| **Clientas y cartera** | Clientas con historial y total comprado, cuentas por cobrar por antigüedad, abonos, recordatorio de cobro por WhatsApp, difusión una por una |
| **Gastos** | Arriendo, servicios, transporte, etc. por categoría |
| **Reportes** | Estado de resultados (ventas − costo − gastos = ganancia neta), ventas por día, medios de pago, categorías, productos estrella, valor del inventario, exportar todo a Excel |
| **Ajustes** | Datos del negocio para los recibos, listas, PIN de administradora, copia de seguridad |

**Códigos de barras:**
- **Con la cámara del celular:** botón *Escanear* en Vender (cada lectura suma al pedido), en Inventario (abre el producto o propone crearlo), en Conteo físico (cada lectura suma 1), en Entrada de mercancía y en el campo *Código de barras* del producto. Lee EAN-13, EAN-8, UPC, Code 128, Code 39 y QR. La cámara solo funciona en la dirección publicada (https), no abriendo el archivo directamente.
- **Con lector USB o Bluetooth (pistola):** se conecta y listo, sin configurar nada. La app reconoce la lectura en cualquier pantalla y hace lo mismo que con la cámara. Sirven los lectores comunes que funcionan "como teclado" y envían Enter al final (así vienen casi todos).
- **Productos sin código de fábrica:** en el producto, *No tiene código: generar uno* crea un código interno (empieza por 2). Luego *Inventario → Etiquetas* genera un PDF para imprimir en hoja carta de 30 etiquetas adhesivas (3 × 10, tipo 5160) o en rollo térmico de 50 × 25 mm, con nombre, precio y código.

**PIN de administradora:** si lo activas, una vendedora puede vender, cobrar y cerrar caja, pero no ve costos ni ganancias, no anula ventas ni cambia ajustes.

**Sin internet:** con Firebase, la app sigue funcionando sin señal y sube los cambios cuando vuelve la conexión (lo indica arriba a la derecha).

---

## Puesta en marcha (una sola vez, unos 15 minutos)

Mientras no hagas esto, la app funciona en **modo demo**: datos de ejemplo guardados solo en ese navegador.

### 1. Crear el proyecto de Firebase
1. Entra a <https://console.firebase.google.com> con tu cuenta de Google y crea un proyecto (por ejemplo `amare-beauty`). Analytics no es necesario.
2. En **Compilación → Firestore Database** pulsa *Crear base de datos*, ubicación `southamerica-east1` (São Paulo) o `us-central1`, modo **producción**.
3. En la pestaña **Reglas** de Firestore, borra lo que hay, pega el contenido del archivo `firestore.rules` de este proyecto y publica.
4. En **Compilación → Authentication** pulsa *Comenzar*, activa **Correo electrónico/contraseña**.
5. En **Authentication → Usuarios → Agregar usuario** crea la cuenta del negocio (un correo y una contraseña). Puedes crear una por persona que vaya a usar la app.

### 2. Conectar la app
1. En Firebase, ⚙️ **Configuración del proyecto → Tus apps → Web (`</>`)**, ponle un nombre y registra la app (no hace falta Hosting).
2. Copia el objeto `firebaseConfig` que aparece.
3. Abre `js/firebase-config.js` y reemplaza `null` por ese objeto:
   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "AIza…",
     authDomain: "amare-beauty.firebaseapp.com",
     projectId: "amare-beauty",
     storageBucket: "amare-beauty.appspot.com",
     messagingSenderId: "…",
     appId: "…"
   };
   ```
   Estos datos no son secretos: lo que protege la información son las reglas del paso 1.3 y el inicio de sesión.
4. En **Authentication → Configuración → Dominios autorizados** agrega `elgallegosph.github.io`.

### 3. Publicar en GitHub Pages
1. Reemplaza los archivos del repositorio `mi-negocio-app` por los de esta carpeta (borra `app.js` y `style.css` viejos de la raíz).
2. Haz commit y push. GitHub Pages publica en `https://elgallegosph.github.io/mi-negocio-app/`.
3. Abre esa dirección, entra con el correo del paso 1.5 y en **Ajustes** completa los datos del negocio.
4. En el celular: menú del navegador → **Agregar a la pantalla de inicio**.

### 4. Pasar los datos de la hoja de Google
1. En la hoja actual, en la pestaña de inventario: **Archivo → Descargar → Microsoft Excel (.xlsx)**.
2. En la app: **Inventario → Importar desde Excel**. Reconoce columnas como *Nombre, Código, Categoría, Precio, Costo, Stock*.
3. Igual con las clientas: **Clientas → Importar desde Excel** (columnas *Nombre* y *Teléfono*).
4. El historial de ventas viejo puede quedarse en la hoja como archivo; la app empieza a contar desde el primer día que se use.

---

## Uso diario sugerido
1. **Al abrir:** Caja → Abrir caja con la base.
2. **Durante el día:** Vender. Los gastos en efectivo se registran en Caja → Gasto.
3. **Cuando llegue mercancía:** Inventario → Entrada.
4. **Al cerrar:** Caja → Cerrar caja, contar billetes y monedas. Compartir el PDF del cierre si hace falta.
5. **Cada semana:** Clientas → Por cobrar, enviar recordatorios.
6. **Cada mes:** Reportes → Este mes, y Ajustes → Descargar copia de seguridad.

## Archivos
```
index.html            Página principal
styles.css            Diseño
manifest.json, sw.js  Instalación como app y apertura sin internet
firestore.rules       Reglas de seguridad para pegar en Firebase
js/firebase-config.js Tu configuración de Firebase
js/db.js              Guardado de datos (Firebase o modo demo)
js/negocio.js         Reglas del negocio: ventas, stock, caja, cartera, reportes
js/documentos.js      Recibos PDF, Excel, respaldos e importación
js/app.js, js/pantallas.js, js/main.js   Pantallas
js/demo.js            Datos de ejemplo del modo demo
```

## Costos
El plan gratuito de Firebase (Spark) incluye 50.000 lecturas y 20.000 escrituras al día; una tienda pequeña usa una fracción de eso.
Para cuidar ese límite, la app carga las ventas, abonos, gastos y cierres de los últimos 400 días y los movimientos de inventario de los últimos 120 días. Las cuentas por cobrar y los separados se cargan siempre, sin importar su fecha. Lo más antiguo sigue guardado en Firebase y se puede consultar desde la consola de Firebase.
