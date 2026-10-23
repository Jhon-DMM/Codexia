# Codexia

Aplicación web de Codexia con registro e inicio de sesión, conversaciones guardadas por usuario y un asistente con límite diario de mensajes.

## Requisitos

- Node.js 20 o superior.
- PostgreSQL 13 o superior.
- Una clave de API del proveedor de IA configurado.

## Variables de entorno

`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` configuran PostgreSQL. `GROQ_API_KEY`, `GROQ_BASE_URL` y `GROQ_MODEL` configuran el proveedor del asistente. `ASISTENTE_LIMITE_DIARIO` define la cuota de mensajes por usuario y día; el valor inicial es 30. `FRONTEND_ORIGIN` permite añadir el origen del frontend si se sirve por separado. Cambia el nombre de base de datos del comando de migración para que coincida con `DB_NAME`.

Las sesiones duran siete días. El navegador recibe una cookie `HttpOnly` con `SameSite=Lax`; la API guarda únicamente el hash del token de sesión. En producción, `NODE_ENV=production` activa `Secure`, por lo que la aplicación debe servirse por HTTPS. Si frontend y API se sirven en orígenes distintos, configura `FRONTEND_ORIGIN` con el origen exacto del frontend; el navegador debe enviar credenciales y ambos orígenes deben compartir el mismo sitio para que `SameSite=Lax` permita la cookie.

Cada usuario puede tener varias conversaciones; cada burbuja se guarda como una fila vinculada a su conversación. El uso diario se cuenta por fecha de PostgreSQL. Si la API de IA falla, el mensaje fallido no consume cuota.

## Modelo de datos

- `usuarios`: cuentas y hashes de contraseña.
- `sesiones`: sesiones revocables; solo se guarda el hash del token.
- `conversaciones`: conversaciones propiedad de un usuario.
- `chats`: burbujas de usuario y respuestas del asistente dentro de una conversación.
- `uso_asistente`: consumo diario por usuario.

Las relaciones y restricciones están en `Backend/database/migrations/001_esquema_inicial.sql`. La migración usa `CREATE TABLE IF NOT EXISTS`: conserva la tabla `usuarios` existente y agrega las tablas que falten. No elimina datos.

## Hojas de estilo

- `Frontend/css/base.css`: variables, tipografía, estilos generales y botones compartidos.
- `Frontend/css/inicio.css`: portada y sus secciones.
- `Frontend/css/asistente.css`: chat, conversaciones y cuota.
- `Frontend/css/cuenta.css`: registro e inicio de sesión.

## Notas

El navegador conserva el identificador de la conversación actual en la sesión, pero la autenticación se gestiona mediante una cookie inaccesible a JavaScript. La API comprueba la propiedad de cada conversación en el servidor. El límite diario se aplica de forma atómica en PostgreSQL para evitar que solicitudes simultáneas lo excedan.
