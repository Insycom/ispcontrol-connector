# Crear un driver de OLT

Trabajamos con **un PR por driver**. Abrí una rama desde main y un PR en borrador para el modelo que vas a incorporar. Incluí el código fuente, las pruebas y las instrucciones para reproducir el binario. Identificá la marca, modelo, firmware y arquitecturas comprobadas. Integrá el PR en main cuando la implementación esté completa y las operaciones anunciadas hayan pasado en laboratorio. Adjuntá resultados sin credenciales ni datos de abonados.

## Contrato de identificación

Al guardar la OLT, el conector asignado recibe la tarea por heartbeat. Instala la versión exacta del catálogo y ejecuta el binario como se muestra a continuación.

    driver identify --config /dev/stdin

El descriptor contiene un objeto JSON con Address (host y puerto), Username, Password y HostKeySHA256. Verificá la huella SSH. Usá consultas de lectura para identificar el equipo. Escribí un único objeto JSON en stdout y terminá con código cero en caso de éxito. El worker limita la ejecución a 90 segundos y la respuesta a 16 KiB. Un fallo debe terminar con código distinto de cero. Las credenciales deben permanecer fuera de los logs.

Ejemplo de respuesta de laboratorio:

    {"deviceId":"OLT-LAB-001","model":"Modelo de prueba","managementIp":"192.0.2.2","vendor":"Fabricante","firmware":"1.0"}

La API requiere deviceId, model y una managementIp válida. También acepta mac, vendor, firmware y outOfBandIp. Conservá el identificador entre sincronizaciones. Si el driver ofrece operaciones sobre ONUs, documentá y probá cada una por separado. La sincronización del panel invoca identify.

## Empaquetar y firmar

En el repositorio de la API, prepará driver-repository/NOMBRE/VERSION/linux/ARQUITECTURA/driver. El instalador reconoce amd64 y arm64. Publicá únicamente las arquitecturas probadas. Para el adaptador de referencia en Go, ejecutá go test ./... y compilá para Linux con GOOS=linux, GOARCH igual al destino y CGO_ENABLED=0. Probá el ejecutable en la arquitectura anunciada.

Desde la raíz de la API, con la clave Ed25519 del publicador disponible en un archivo privado, ejecutá:

    DRIVER_IDENTIFY=1 DRIVER_SIGNING_KEY=/ruta/privada node scripts/sign-driver.mjs NOMBRE VERSION MODELO FIRMWARE amd64

Agregá arm64 al comando si también preparaste ese binario. El manifiesto firmado incluye tamaño, SHA-256 y operaciones. El instalador valida la firma con repository.pub. Distribuí el directorio de versión completo según docs/olt-packages.md de la API. Para corregir una release publicada, asigná una versión nueva.

## Verificar antes del merge

1. Probá el parser con respuestas reales anonimizadas, campos ausentes y errores. Verificá el rechazo de una huella incorrecta.
2. Desde un conector de laboratorio con ruta hacia la OLT, elegí el paquete en Sitios → OLTs y guardá el equipo. Contrastá el ID, modelo e IP reportada con los de la OLT.
3. Repetí la sincronización y verificá que reutilice la versión instalada. Probá una descarga dañada en un repositorio de prueba y verificá que se preserve la versión previa. Probá la vuelta a una versión publicada compatible.
4. Registrá en el PR modelo, firmware, arquitectura, versión, operaciones verificadas y resultado. Las escrituras requieren una ONU de laboratorio identificada. Como referencia, consultá [las pruebas C-Data](lab/cdata.md).
