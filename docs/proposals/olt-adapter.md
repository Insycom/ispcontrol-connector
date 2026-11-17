# Propuesta: INSYCOM OLT Adapter integrado al conector

> **Estado:** propuesta técnica, sin activación en producción. Este documento no implementa aún drivers ni cambia el arranque actual.

## Objetivo
Incorporar un proceso secundario `olt-api` compilado en Go dentro de **la misma imagen y el mismo contenedor** que ISP Control Connector. El conector conserva toda la lógica de negocio, decide las acciones y envía solicitudes a `127.0.0.1:8765`. El adaptador no mantiene inventario de clientes ni OLT, no administra OLT y no expone consola genérica.

## Alcance inicial (únicamente ONT)
- `POST /api/v1/{cdata|wolk|tplink}/onts/pending`: ONT pendientes de autorización.
- `POST /api/v1/{cdata|wolk|tplink}/onts/optical`: estado y potencia óptica por serial y PON opcional.
- `POST /api/v1/{cdata|wolk|tplink}/onts/authorize`: autorizar una ONT con parámetros validados por driver.
- `GET /health`: estado del proceso y versiones de drivers.

Todos los POST reciben un JSON con `connection` (host, protocolo, puerto, autenticación) y `ont` cuando corresponda. Los endpoints son por fabricante, mientras los drivers se especializan por modelo/firmware. No aceptar comandos CLI arbitrarios.

## Separación de responsabilidades
- **Conector:** inventario, autorización del usuario, decisión comercial, solicitudes, idempotencia a nivel de negocio y auditoría de clientes.
- **Adaptador:** validación técnica, conexión temporal SNMP/SSH, traducción de comandos, parseo, verificación posterior de escritura, errores estructurados.
- **OLT:** dispositivo remoto. No modificar configuración general, VLAN, perfiles ni servicios salvo parámetros estrictamente necesarios para la autorización y explícitamente validados.

## Seguridad
- Escuchar exclusivamente en `127.0.0.1:8765`, sin `ports` publicados.
- La API local no debe aceptar destinos arbitrarios: aplicar allowlist de IP/subredes de gestión, protocolos y puertos.
- Autenticación local entre procesos (token de vida limitada o socket Unix si conviene).
- No persistir credenciales ni incluirlas en logs, trazas o errores; evitar contraseñas en argumentos de procesos.
- Base64 **no cifra**; no usarlo como medida de seguridad. Preferir transporte local y secretos protegidos.
- Verificar host keys SSH; preferir SNMPv3 cuando exista.
- Sin reintentos ciegos de escrituras; consultar el estado antes y después, controlar concurrencia por ONT.
- Timeouts y límites de concurrencia, respuestas normalizadas sin filtraciones de CLI.

## Distribución propietaria
- Código Go y drivers en repositorio **privado**.
- Pipeline privado compila y prueba; la imagen distribuida contiene solo el binario.
- Compilar con `-trimpath` y `-ldflags="-s -w"`; evaluar Garble (`-literals`, `-tiny`) con pruebas de compatibilidad. No prometer imposibilidad de ingeniería inversa.
- Mantener build interno con depuración y release público ofuscado.
- Verificar licencias de dependencias y evitar secretos embebidos.
- Versionar API, drivers y conector independientemente; publicar nueva imagen al actualizar el binario.

## Plan de implementación futuro
1. Revisar Dockerfile, entrypoint, lenguaje y healthchecks reales del conector; elegir supervisor de dos procesos con propagación de señales y reinicio controlado.
2. Definir esquemas OpenAPI, errores, timeouts y pruebas contractuales sin tocar las OLT.
3. Crear binario Go con endpoints simulados y pruebas automatizadas; integrar al build de la imagen.
4. Investigar C-Data, Wolk y TP-Link **solo lectura** sobre equipos autorizados; guardar fixtures anonimizados y tests de parsers.
5. Habilitar autorización únicamente con ONT de prueba y aprobación explícita; verificar resultado.
6. Ejecutar CI, revisar seguridad, compatibilidad y publicación; habilitar funciones gradualmente.

## Criterios de aceptación
- Sin cambios funcionales en el conector actual hasta activar explícitamente la integración.
- Sin API OLT accesible desde la red externa del contenedor.
- Las tres operaciones responden con JSON consistente y códigos de error documentados.
- Credenciales no se almacenan ni aparecen en logs.
- Tests de drivers con fixtures; pruebas de integración sin escrituras por defecto.
- Builds públicos sin fuentes Go ni herramientas de compilación.
