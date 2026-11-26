# Connector de laboratorio para C-Data

Imagen Linux amd64: `ghcr.io/insycom/ispcontrol-connector:cdata-lab-v0.1.0-rc.1`. Esta edición conserva el proceso habitual del Connector e incluye el ejecutable local `ispcontrol-olt`. Las operaciones se invocan dentro del contenedor. Esta sección describe la imagen histórica de laboratorio. La identificación desde el panel usa el repositorio firmado y el flujo documentado en [Crear un driver](../crear-driver-olt.md).

Montar un archivo JSON de solo lectura en `/run/secrets/cdata-olt.json`, legible por el usuario que ejecutará el comando. Debe contener `Address` (host:puerto), `Username`, `Password` y `HostKeySHA256` (huella verificada de la clave pública SSH del equipo). La red del contenedor debe tener ruta de gestión a la OLT. Modelo y firmware soportados: C-Data FD1604S-B1, V3.3.65_250926.

En estos ejemplos CONNECTOR es el contenedor de laboratorio y SN el serial GPON. Para un alta, PORT, LINE y SERVICE corresponden al puerto descubierto y a los perfiles reales. Seleccionar el equipo de pruebas antes de ejecutar cualquiera de las escrituras.

```sh
docker exec "$CONNECTOR" ispcontrol-olt pending
docker exec "$CONNECTOR" ispcontrol-olt authorize --sn "$SN" --port "$PORT" --line "$LINE" --service "$SERVICE" --confirm "$SN"
docker exec "$CONNECTOR" ispcontrol-olt optical --sn "$SN"
docker exec "$CONNECTOR" ispcontrol-olt status --sn "$SN"
docker exec "$CONNECTOR" ispcontrol-olt registration --sn "$SN" --state disabled --confirm "$SN"
docker exec "$CONNECTOR" ispcontrol-olt registration --sn "$SN" --state enabled --confirm "$SN"
docker exec "$CONNECTOR" ispcontrol-olt reboot --sn "$SN" --confirm "$SN"
```

Para validar un alta, comenzar con una ONU sin autorizar y conservar el resultado de pendientes. Tras habilitar o deshabilitar el registro, consultar estado y comprobar que la ONU conserva serial y perfiles. Tras reiniciar, verificar la recuperación con status. Un acuse perdido requiere reconciliar el estado antes de repetir una orden. El parser de pendientes con ONU presente y las tres operaciones de escritura requieren validación en el equipo de laboratorio.

Las lecturas de alarmas se limitan a dos páginas por lista. El JSON incluye activeTruncated e historyTruncated; cuando son verdaderos puede haber más alarmas del serial fuera de las páginas leídas. Esta versión de laboratorio se opera desde el host del Connector con acceso Docker y devuelve JSON al operador; todavía no escribe auditoría en la API central.

Para pruebas de escritura, agregar el campo LabSerial al JSON con el serial de la ONU de laboratorio. El ejecutable exige además la confirmación del mismo serial en cada orden. Con el campo vacío se permiten las consultas.
