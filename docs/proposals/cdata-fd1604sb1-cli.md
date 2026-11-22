# C-Data FD1604S-B1 · perfil CLI observado

Hardware V1.1, firmware V3.3.65_250926. La sesión SSH interactiva mostró el modelo y las versiones en el banner. El prompt de usuario termina en `>`. Desde ahí, `enable` abre el menú privilegiado; `config` y `interface gpon 0/0` seleccionan el contexto GPON observado. `end` regresa al prompt privilegiado. El driver necesita reconocer el prompt y el paginador de la CLI.

## Consultas ejecutadas en contexto GPON

| Consulta | Resultado observado | Uso en ISP Control |
|---|---|---|
| `show ont autofind all` | La consulta terminó correctamente con cero ONT pendientes. Falta una muestra con una ONT nueva. | Descubrimiento para altas |
| `show ont info 1 1` | Puerto, ID, serial, distancia, estado operativo y de configuración, causa de última caída, horas de conexión/desconexión y dying gasp | Ficha técnica y diagnóstico |
| `show ont optical-info 1 1` | RX/TX de la ONT, RX de la OLT, umbrales, temperatura, tensión y corriente del láser | Diagnóstico de degradación óptica |
| `show ont status-count brief` | Conteos de estados operativos y de configuración | Resumen de estado de acceso |

Los números 1 y 1 son los argumentos PON y ONT usados en la prueba. Para otros equipos deben resolverse desde inventario. El equipo identifica ONT de 1 a 128 por puerto en la ayuda consultada. Para las mediciones, el parser deberá distinguir valores numéricos de campos ausentes o no aplicables.

## Variantes de lectura anunciadas por la CLI

- Inventario con `show ont info all` o `show ont info <puerto> all`. Ambas formas ofrecen filtros `online` y `sn-format`. Para localizar una ONT por serial figura `show ont info by-sn <serial>`.
- Para descubrimiento por puerto, la ayuda ofrece `show ont autofind 0/0 <puerto>` seguido de `all` o `sn`. Para potencia de un puerto completo figura `show ont optical-info <puerto> all`.
- El menú privilegiado ofrece consultas de alarmas, eventos, CPU, memoria, temperatura, ventiladores, alimentación, SFP, firmware, VLAN, service-port y perfiles. El índice adjunto conserva las variantes encontradas en cada contexto.
- El contador admite `show ont status-count` y la variante `brief`. Este firmware rechazó `show ont status-count 1`.

## Autorización anunciada, pendiente de prueba en laboratorio

`ont confirm <puerto>` ofrece ramas por serial, LOID o contraseña, además de una rama masiva. `ont add <puerto> <ont-id>` permite indicar el ID y ofrece los mismos tres métodos individuales. Después del serial, la ayuda ofrece perfil de línea por nombre o ID, perfil multiservicio y autenticación adicional. La ayuda marca fin de comando en algunas ramas de alta. En la rama de confirmación por serial, la ayuda acepta la secuencia perfil de línea por ID → perfil de servicio por ID → fin de comando. Ambos ID admiten 0 a 2300. Para probar el alta falta elegir los perfiles aprovisionados en la OLT y una ONT de laboratorio. La rama masiva queda fuera de la operación individual de ISP Control.

La sintaxis de escritura se inspeccionó con ayuda contextual y cancelación de la línea. La siguiente prueba requiere una ONT de laboratorio y perfiles identificados para este firmware. Antes de escribir, resolver una sola ONT por serial y puerto; después, verificar el resultado consultando esa misma ONT.

[Índice de ayuda observado por modo y prefijo](cdata-fd1604sb1-help.tsv). El índice registra tokens de la ayuda, incluidas continuaciones y rangos. Los prefijos con valores concretos son ejemplos de navegación. La exploración cubre los menús principales y profundiza en GPON; otras tarjetas, permisos, firmwares y parámetros pueden exponer variantes adicionales.

## Alarmas y operaciones individuales en V3.3.65_250926

En modo privilegiado se verificaron las dos consultas siguientes sobre un puerto con eventos reales. Ambas salidas son paginadas.

- Activas: `show alarm active alarmparameter gpon <frame>/<slot>/<puerto> detail`.
- Históricas: `show alarm history alarmparameter gpon <frame>/<slot>/<puerto> detail`.

La CLI filtra por PON. En cada registro, el bloque INSTANCE puede incluir FrameID, SlotID, PortID, OnuID, Uni y ONU-SN. Para mostrar alarmas individuales se debe comparar el serial normalizado con ONU-SN y la ubicación con la devuelta por la consulta de inventario. Los eventos que solo identifican el PON se muestran como eventos del puerto. En histórico, el encabezado puede incluir la fecha de despeje (clear). Se observaron pérdida de señal de ONU y caída del enlace Ethernet de un puerto de usuario.

En el contexto GPON, la ayuda de `ont disable <puerto>` y `ont enable <puerto>` admite selección por serial mediante `sn` o por ONT-ID. Las ramas activate/deactivate ofrecen ID o selección masiva. Estos datos distinguen los selectores, pero el efecto sobre registro y conservación de perfiles requiere una prueba controlada. El reinicio individual llega a fin de comando con `ont reboot <puerto> <ONT-ID>`. Validar en la ONT de prueba el acuse, caída y posterior retorno.
