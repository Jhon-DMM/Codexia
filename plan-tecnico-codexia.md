# Plan tecnico de Codexia

## Objetivo

Convertir Codexia de un MVP funcional a una base mas segura, mantenible y escalable, sin frenar la evolucion del producto.

## Resultado esperado

- Despliegue mas seguro
- Backend cubierto en flujos criticos
- Frontend mas mantenible
- Menor riesgo operativo
- Base preparada para crecer en usuarios, funciones y equipo

## Fase 1 - Cerrar riesgos inmediatos

### 1.1 Servido seguro del frontend

**Objetivo:** evitar que Express exponga `Frontend/` completo cuando no exista `dist`.

**Archivos:**
- `Backend/src/app.js`
- `README.md`

**Tareas:**
- Servir solo `Frontend/dist` en produccion.
- En desarrollo, usar una estrategia explicita:
  - Vite por separado, o
  - un fallback controlado solo a paginas publicas necesarias.
- Si `dist` no existe en produccion, fallar con mensaje claro en lugar de servir el arbol fuente.
- Documentar el flujo correcto de arranque local y despliegue.

**Criterio de cierre:**
- `src/`, `package.json` y archivos internos del frontend no quedan expuestos por HTTP.

### 1.2 Validacion fuerte de variables de entorno

**Objetivo:** evitar fallos ambiguos por configuracion incompleta.

**Archivos:**
- `Backend/src/services/asistente.servicio.js`
- `Backend/src/database/conexion.js`
- `Backend/servidor.js`
- `README.md`

**Tareas:**
- Validar al iniciar:
  - `DB_HOST`
  - `DB_PORT`
  - `DB_NAME`
  - `DB_USER`
  - `DB_PASSWORD`
  - `GROQ_API_KEY`
  - `GROQ_MODEL`
- Eliminar el fallback incorrecto que usa `OpenAI_API_VERSION` como modelo.
- Mostrar errores legibles al arrancar si falta configuracion critica.

**Criterio de cierre:**
- El servidor no arranca con configuracion invalida y explica exactamente que falta.

### 1.3 Hardening basico de despliegue

**Objetivo:** dejar una base segura para entorno real.

**Archivos:**
- `Backend/src/config/sesion.config.js`
- `Backend/src/app.js`
- `README.md`

**Tareas:**
- Revisar politica de cookies para produccion.
- Dejar documentado el uso obligatorio de HTTPS.
- Confirmar `FRONTEND_ORIGIN` y `credentials: true` segun el despliegue.
- Añadir notas operativas de seguridad al README.

**Criterio de cierre:**
- Hay una guia de despliegue minima y consistente.

## Fase 2 - Blindar backend con pruebas

### 2.1 Montar base de testing del backend

**Objetivo:** poder validar regresiones en autenticacion, chat y admin.

**Archivos nuevos sugeridos:**
- `Backend/tests/usuarios.test.js`
- `Backend/tests/asistente.test.js`
- `Backend/tests/admin.test.js`
- `Backend/tests/helpers/*.js`
- `Backend/package.json`

**Tareas:**
- Elegir stack de pruebas:
  - `node:test` + `supertest`, o
  - `vitest` + `supertest`
- Preparar base de datos de test o esquema aislado.
- Añadir script `test`.
- Añadir script opcional `test:watch`.

**Criterio de cierre:**
- El repo tiene una suite ejecutable en local.

### 2.2 Cubrir flujos criticos

**Objetivo:** proteger lo mas sensible del sistema.

**Casos prioritarios:**
- Registro correcto
- Login correcto
- Login fallido con bloqueo progresivo
- Cierre de sesion
- Consulta de cuenta autenticada
- Crear conversacion
- Enviar mensaje
- Reintento idempotente por `clientMessageId`
- Limite diario del asistente
- Acceso admin permitido y denegado
- Crear y responder soporte

**Archivos foco:**
- `Backend/src/controllers/*.js`
- `Backend/src/services/*.js`
- `Backend/src/middleware/*.js`

**Criterio de cierre:**
- Los flujos mas delicados quedan cubiertos por pruebas automatizadas.

## Fase 3 - Refactor del frontend para mantenibilidad

### 3.1 Reducir los scripts monoliticos

**Objetivo:** bajar complejidad y acoplamiento.

**Archivos foco (migración completada):**
- `Frontend/src/pages/Assistant.jsx` y `Frontend/src/hooks/useAssistant.js`
- `Frontend/src/pages/Admin.jsx` y `Frontend/src/hooks/useAdmin.js`

**Tareas:**
- La interfaz del asistente y del panel admin ya se renderiza y gestiona con React, separada por dominio:
  - API client
  - estado de UI
  - render de conversaciones
  - modales
  - soporte
  - auditoria
  - eliminaciones admin
- Extraer utilidades repetidas:
  - `apiBaseUrl`
  - `fetch` autenticado
  - formateadores
  - notificaciones

**Criterio de cierre:**
- Ningun archivo principal concentra casi toda la logica de una pantalla.

### 3.2 Unificar el patron de frontend

**Objetivo:** dejar de mezclar React con manipulacion manual del DOM como estrategia principal.

**Archivos foco:**
- `Frontend/src/pages/Assistant.jsx`
- `Frontend/src/pages/Admin.jsx`
- `Frontend/src/pages/Account.jsx`
- `Frontend/js/*.js`

**Tareas:**
- Migrar gradualmente interacciones del chat a componentes React.
- Migrar gradualmente interacciones de admin a componentes React.
- Mantener `Account.jsx` como referencia del enfoque mas limpio.
- Introducir una capa simple de hooks o modulos de estado compartido.

**Criterio de cierre:**
- Las nuevas funcionalidades no dependen de crecer `asistente.js` ni `admin.js`.

### 3.3 Añadir pruebas basicas de frontend

**Objetivo:** proteger login y flujos visibles.

**Archivos nuevos sugeridos:**
- `Frontend/src/**/*.test.jsx`
- `Frontend/package.json`

**Cobertura inicial:**
- Pestanas login/registro
- Validaciones de password
- Mensajes de error
- Estados bloqueados
- Render basico de vistas criticas

## Fase 4 - Mejorar operacion y observabilidad

### 4.1 Estandarizar logs y errores

**Objetivo:** facilitar diagnostico en produccion.

**Archivos foco:**
- `Backend/src/app.js`
- `Backend/src/controllers/*.js`
- `Backend/servidor.js`

**Tareas:**
- Normalizar logs de error.
- Evitar `console.error` disperso sin contexto.
- Añadir identificador de request si el proyecto sigue creciendo.
- Diferenciar errores de validacion, autenticacion, proveedor externo y servidor.

**Criterio de cierre:**
- Los fallos importantes quedan trazables y entendibles.

### 4.2 Health checks mas utiles

**Objetivo:** tener señal real del estado del sistema.

**Archivos foco:**
- `Backend/src/controllers/admin.controller.js`
- `Backend/src/services/admin.servicio.js`

**Tareas:**
- Mantener check de DB.
- Añadir verificacion no destructiva del proveedor IA si aplica.
- Reportar configuracion y dependencias de forma clara.

## Fase 5 - Escalabilidad real del backend

### 5.1 Separar trabajos periodicos del proceso web

**Objetivo:** que limpieza y eliminaciones no dependan del proceso HTTP.

**Archivos foco:**
- `Backend/servidor.js`
- `Backend/src/services/usuarios.servicio.js`
- `Backend/src/services/eliminaciones.servicio.js`

**Tareas:**
- Mover limpieza de piloto a job separado.
- Mover ejecucion de eliminaciones programadas a job separado.
- Dejar el servidor web centrado en responder requests.

**Criterio de cierre:**
- Los jobs pueden ejecutarse de forma independiente.

### 5.2 Preparar el chat para mayor volumen

**Objetivo:** evitar que el request-response del chat quede corto cuando aumente el trafico.

**Archivos foco:**
- `Backend/src/services/conversaciones.servicio.js`
- `Backend/src/services/asistente.servicio.js`
- `Frontend/src/pages/Assistant.jsx`
- `Frontend/src/hooks/useAssistant.js`

**Tareas:**
- Evaluar uno de estos caminos:
  - streaming de respuesta
  - cola asincrona con polling
  - worker para llamadas a IA
- Medir tiempos de respuesta y errores del proveedor.

**Criterio de cierre:**
- El chat no depende solo de requests largos sincronicos.

### 5.3 Optimizar consultas administrativas

**Objetivo:** sostener crecimiento de datos sin degradar el panel.

**Archivos foco:**
- `Backend/src/services/admin.servicio.js`
- `Backend/database/migrations/*.sql`

**Tareas:**
- Revisar `listarClientes` y `obtenerResumen`.
- Analizar planes de ejecucion cuando haya mas volumen.
- Añadir indices si hacen falta.
- Considerar tablas agregadas o vistas materializadas para metricas.

**Criterio de cierre:**
- El panel admin responde bien con volumen mayor al piloto.

## Orden recomendado

1. Fase 1 completa
2. Fase 2 completa
3. Fase 3.1 y 3.2
4. Fase 4
5. Fase 5

## Plan de trabajo sugerido en sprints

### Sprint 1
- Servido seguro del frontend
- Validacion de entorno
- Ajustes de cookie y despliegue

### Sprint 2
- Infra de testing backend
- Tests de autenticacion
- Tests de conversaciones y cuota

### Sprint 3
- Migración del asistente a componentes y estado React (completada)
- Extraccion de cliente API comun
- Reduccion de duplicacion en frontend

### Sprint 4
- Migración del panel admin a componentes y estado React (completada)
- Mejoras de logs y errores
- Health checks mas claros

### Sprint 5
- Jobs separados
- Preparacion de escalabilidad del chat
- Optimizacion del panel admin

## Definicion de exito

El plan se considera bien ejecutado si:

- el despliegue no expone codigo fuente del frontend
- la configuracion invalida falla rapido y con mensajes claros
- existe cobertura automatizada sobre login, sesiones, chat y admin
- el frontend deja de depender de scripts gigantes para crecer
- las tareas periodicas pueden correr fuera del servidor web
- el sistema puede crecer sin que mantenimiento y operacion se vuelvan fragiles
