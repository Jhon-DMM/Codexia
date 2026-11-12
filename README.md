# Codexia

Aplicación web de Codexia con registro e inicio de sesión, conversaciones guardadas por usuario y un asistente con límite diario de mensajes.

## Requisitos

- Node.js 20 o superior.
- PostgreSQL 13 o superior.
- Una clave de API del proveedor de IA configurado.

## Variables de entorno

`DATABASE_URL` configura PostgreSQL con una URL de conexión; si no está definida, se usan `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. `GROQ_API_KEY`, `GROQ_BASE_URL` y `GROQ_MODEL` configuran el proveedor del asistente. `RESEND_API_KEY` y `EMAIL_FROM` configuran el envío de códigos de verificación por Resend en producción; el remitente debe pertenecer a un dominio verificado. `ASISTENTE_LIMITE_DIARIO` define la cuota de mensajes por usuario y día; el valor inicial es 30. `FRONTEND_ORIGIN` permite añadir el origen del frontend si se sirve por separado. `RATE_LIMIT_SECRET` es una clave aleatoria de al menos 32 bytes, obligatoria en producción, que protege los identificadores seudónimos de los límites de acceso; debe mantenerse estable, porque cambiarla reinicia los contadores. `LOGIN_IP_MAX_SOLICITUDES` y `LOGIN_IP_VENTANA_SEGUNDOS` permiten ajustar el límite por IP; sus valores predeterminados son 60 solicitudes y 900 segundos. `REGISTRO_IP_MAX_SOLICITUDES` y `REGISTRO_IP_VENTANA_SEGUNDOS` permiten ajustar el límite de operaciones de registro y reenvío por IP; sus valores predeterminados son 10 solicitudes y 86 400 segundos (24 horas). `TRUST_PROXY_HOPS` indica cuántos proxies controlados hay delante de Express; déjalo en `0` si la API recibe conexiones directamente y configúralo según el despliegue si hay proxy. No lo pongas en `true` sin conocer la topología.

Al iniciar, el backend comprueba que estén configuradas las credenciales requeridas de PostgreSQL y Groq, y que `DB_PORT` sea un entero válido. Si falta alguna, muestra los nombres de las variables pendientes y termina antes de montar la API.

Las contraseñas nuevas se protegen con Argon2id. El registro valida en el servidor nombre, correo, contraseña y aceptación de documentos legales; las consultas usan parámetros SQL. Una cuenta nueva queda pendiente hasta confirmar un código de seis dígitos: vence en 10 minutos, admite cinco intentos y limita reenvíos por cuenta e IP. En desarrollo, el código se imprime en la terminal del backend; en producción se envía por Resend. Para reducir la creación automatizada de cuentas, se permiten 10 operaciones de registro o reenvío por IP cada 24 horas por defecto. El inicio de sesión permite tres contraseñas incorrectas por combinación de cuenta e IP, con pausas progresivas de 15 minutos, 30 minutos, 1 hora y 24 horas. Además, limita a 60 las solicitudes válidas de inicio de sesión por IP en 15 minutos (también cuenta los accesos correctos); los contadores se guardan como HMAC en PostgreSQL y responden con HTTP 429 y `Retry-After`. Un inicio correcto reinicia la escalada por cuenta e IP, mientras el límite general por IP vence al finalizar su ventana. Las cuentas existentes con bcrypt siguen pudiendo iniciar sesión y su hash se actualiza a Argon2id después de verificar correctamente la contraseña. Las sesiones duran siete días. El navegador recibe una cookie `HttpOnly` con `SameSite=Lax`; la API guarda únicamente el hash del token de sesión. En producción, `NODE_ENV=production` activa `Secure`, por lo que la aplicación debe servirse por HTTPS. Si frontend y API se sirven en orígenes distintos, configura `FRONTEND_ORIGIN` con el origen exacto del frontend; el navegador debe enviar credenciales y ambos orígenes deben compartir el mismo sitio para que `SameSite=Lax` permita la cookie.

Cada usuario puede tener varias conversaciones; cada burbuja se guarda como una fila vinculada a su conversación. El uso diario se cuenta por fecha de PostgreSQL. Si la API de IA falla, el mensaje fallido no consume cuota.

## Modelo de datos

- `usuarios`: cuentas y hashes de contraseña.
- `usuarios.rol` y `usuarios.estado`: rol cliente/admin y estado activo/suspendido para autorizar la consola y revocar cuentas.
- `sesiones`: sesiones revocables; solo se guarda el hash del token.
- `conversaciones`: conversaciones propiedad de un usuario.
- `chats`: burbujas de usuario y respuestas del asistente dentro de una conversación.
- `uso_asistente`: consumo diario por usuario.
- `aceptaciones_legales`: versión, huella SHA-256, fecha, formulario, IP y navegador para acreditar la aceptación. Si se elimina una cuenta manualmente, la constancia mínima se conserva hasta completar los siete días del piloto; luego se borra.
- `admin_auditoria`: accesos a datos de clientes/soporte y cambios que realiza el equipo admin.
- `solicitudes_soporte`: consultas de clientes y respuesta; registra la versión/hash de privacidad aceptada, fecha, IP y navegador.
- `eliminaciones_cuenta`: instrucciones admin de eliminación inmediata/programada y el aviso mínimo posterior con hash de correo, motivo y detalles.

Las relaciones y restricciones están en `Backend/database/migrations/`. Ejecuta `npm run migrate` desde `Backend` después de configurar PostgreSQL. Las migraciones conservan las tablas existentes y agregan las que falten. No eliminan datos.

## Consola de administración

La consola está en `/es/admin/index.html`. El rol se valida en la API; conocer la URL no da permisos. Incluye métricas agregadas, búsqueda de clientes, suspensión/reactivación, solicitudes de soporte y privacidad, uso, estado del servicio y auditoría de cambios administrativos. No permite leer conversaciones. Los cobros y costos reales de IA no se simulan: todavía requieren un proveedor de pagos y registro de tokens/costos.

Las solicitudes de soporte se envían desde Cuenta, requieren aceptar el tratamiento de su contenido y guardan versión/hash de privacidad, hora, IP y agente de usuario. La respuesta del equipo aparece al volver a abrir Cuenta; no hay notificación por correo integrada.

Después de aplicar las migraciones, crea una cuenta normal para el propietario y asígnale el rol admin desde `Backend` con `npm run admin:promover -- correo@dominio.com`. No hay forma de registrarse como admin desde la página pública.

El piloto sigue activo en desarrollo si no se configura `PILOTO_ACTIVO`; elimina datos al cumplirse siete días. En `NODE_ENV=production` se desactiva por defecto para evitar que clientes comerciales hereden el borrado automático. Define `PILOTO_ACTIVO=false` explícitamente al lanzar. Revisa y reemplaza también los avisos y documentos legales que describen la prueba antes de aceptar clientes comerciales.

La consola permite programar la eliminación admin inmediata o en 1, 12, 24 o 72 horas. El cliente ve el motivo y detalle mientras la eliminación está pendiente; después, el aviso solo se muestra al iniciar sesión con el correo y la contraseña correctos. Para esa comprobación se conserva en `eliminaciones_cuenta` el hash de contraseña de la cuenta eliminada, separado del perfil y las conversaciones. El verificador no crea una sesión ni permite recuperar la cuenta. No se guarda la contraseña en texto claro. Aún no hay verificación por correo ni notificación email. La política de privacidad informa esta conservación; antes de un lanzamiento público debe definirse el plazo máximo de conservación del aviso y revisarse el tratamiento legal aplicable.

Los documentos legales están en `Frontend/es/legal/`. Al publicar cambios materiales, actualiza la versión correspondiente en `Backend/src/config/documentos-legales.js` para que las nuevas aceptaciones queden ligadas a esa versión y su huella.

El piloto dura siete días desde que cada cuenta se habilita; en cuentas nuevas, desde el registro. Al vencer, el asistente bloquea el acceso y el backend elimina la cuenta, sus conversaciones y las constancias legales. La limpieza corre al iniciar el servidor y cada minuto mientras está activo.

## Hojas de estilo

- `Frontend/css/base.css`: variables, tipografía, estilos generales y botones compartidos.
- `Frontend/css/inicio.css`: portada y sus secciones.
- `Frontend/css/asistente.css`: chat, conversaciones y cuota.
- `Frontend/css/cuenta.css`: registro e inicio de sesión.

## Frontend estático con React

El frontend usa Vite como herramienta de desarrollo y compilación. React se ejecuta en el navegador para renderizar la página principal; al compilar, Vite produce archivos HTML, CSS, JavaScript e imágenes estáticos en `Frontend/dist`. El sitio publicado no necesita un servidor React ni renderizado del lado servidor. La API Express sigue siendo necesaria para autenticación, conversaciones, PostgreSQL y Groq.

Para desarrollo, ejecuta `npm run dev` desde `Frontend` para iniciar Vite (normalmente en `http://localhost:5173`) y, en otra terminal, `npm run dev` desde `Backend` para iniciar la API en `http://localhost:3000`. Express no sirve el árbol fuente del frontend durante el desarrollo.

Para producción, ejecuta `npm run build` desde `Frontend` antes de iniciar el backend con `NODE_ENV=production`. Express sirve únicamente `Frontend/dist`; si esa carpeta no existe, `Backend/servidor.js` detiene el arranque con un mensaje claro. Las rutas HTML generadas para cada página se sirven como archivos estáticos; no hay un fallback general a la portada.

La página principal, el acceso/registro, el acceso administrativo, el asistente y el panel admin se renderizan con React. Las interacciones del asistente y de la consola admin se gestionan con estado y componentes React; las páginas legales conservan HTML estático por su naturaleza documental. Las hojas de estilo existentes se reutilizan.

## Formato del código

El estilo se define en `.prettierrc.json` y `.editorconfig`. Para aplicar el mismo formato a los archivos del frontend, backend y README, ejecuta `npm run format` desde `Frontend`. Para revisar el formato sin modificar archivos, ejecuta `npm run format:check`. Las dependencias, archivos compilados, secretos y migraciones SQL quedan fuera del formateo automático.

## Pruebas del backend

Desde `Backend`, ejecuta `npm test`. El comando aplica las migraciones exclusivamente a la base `codexia_test` y luego ejecuta las pruebas HTTP y de integración. La suite verifica login, sesiones, permisos, persistencia y propiedad de conversaciones, idempotencia de mensajes, cuota diaria y devolución de cuota si falla la IA. Las pruebas no llaman a Groq. Las credenciales de conexión se leen de `Backend/.env`, pero el nombre de base se fija a `codexia_test`; no se usa `DB_NAME` para estas pruebas. `npm run test:database` ejecuta solo las pruebas de PostgreSQL. `npm run test:watch` vuelve a ejecutar la suite al cambiar archivos, pero requiere que `codexia_test` ya tenga las migraciones aplicadas. Nunca apuntes las pruebas a una base con datos reales.

## Notas

El navegador conserva el identificador de la conversación actual en la sesión, pero la autenticación se gestiona mediante una cookie inaccesible a JavaScript. La API comprueba la propiedad de cada conversación en el servidor. El límite diario se aplica de forma atómica en PostgreSQL para evitar que solicitudes simultáneas lo excedan.
