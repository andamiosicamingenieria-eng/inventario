# Casos de Uso — Módulo Generación y Seguimiento de Contratos

Este documento recoge los casos de uso principales del módulo de **Contratos** (nuevo, renovación total/parcial, venta, venta por pérdida, cancelación, cierre) y describe explícitamente cómo cada caso afecta la creación y el flujo de las **HS (Hoja de Salida)**, **HE (Hoja de Entrada)** y las **Solicitudes de Salida/Entrada**, así como el inventario y los estatus.

---

## Nota sobre responsabilidades clave

El **Revisor de Contratos** genera:
- **Solicitud de Salida (SS)**: autorización de entrega de equipo desde almacén.
- **Solicitud de Entrada (SE)**: solicitud de recolección/devolución de equipo.
- **HS y HE automáticas**: solo en casos de **Venta por Pérdida**, **Venta por Solicitud del Cliente** y **Cancelación por Solicitud Expresa del Cliente** (procesos cerrados sin intervención de inventarios).

El **Encargado de Inventarios** genera:
- **Hoja de Salida (HS)** final: ejecuta la solicitud de salida y realiza la salida física de equipo; descuenta inventario.
- **Hoja de Entrada (HE)** final: ejecuta la solicitud de entrada y recibe la devolución física; incrementa inventario.

---

## 1. Nuevo Contrato — Renta

- Objetivo: Registrar un contrato de renta con sus items y condiciones.
- Precondiciones: Cliente existente o creado o agregar opción para de dar de alta en este panel; catalogo de productos disponible; cantidades solicitadas.
- Flujo principal:
  1. Usuario (Revisor de Contratos) crea el contrato con `tipo_operacion = 'RENTA'`.
  2. Usuario crea el contrato → sistema asigna `folio_contrato` (secuencia: Math.max + 1).
  3. Se guardan los `contrato_items` asociados.
  4. Estado inicial: pendiente de entrega (sin HS aún).
- Efectos en HS/HE y solicitudes:
  - No se genera HS/HE automáticamente al crear el contrato.
  - El **Revisor de Contratos** genera una **Solicitud de Salida (SS)** cuando requiere que se entregue equipo.
  - El **Encargado de Inventarios** recibe la SS, valida stock disponible, crea la **HS** final y ejecuta la salida física.
  - La **Solicitud de Entrada (SE)** será generada por el Revisor cuando corresponda recolectar equipo.
  - El **Encargado de Inventarios** recibe la SE, crea la **HE** final y realiza la recepción física.
- Inventario: Sin cambios hasta que el Encargado de Inventarios guarde una HS (salida) o una HE (entrada).
- Notas: Al abrir el panel SS para este contrato, el Revisor debe indicar cantidades a solicitar. El sistema debe calcular `pendiente = cantidad_contrato - ya_entregado` como referencia. La validación de stock ocurre en el panel HS del Encargado de Inventarios.

## 2. Nuevo Contrato — Venta

- Objetivo: Registrar una venta (transferencia definitiva de equipo).
- Precondiciones: Cliente y items definidos.
- Flujo principal:
  1. Usuario (Revisor de Contratos) crea el contrato con `tipo_operacion = 'VENTA'`.
  2. Estado inicial: `VENTA` (entrega pendiente).
  3. El **Revisor de Contratos** genera una **Solicitud de Salida (SS)** con los items y cantidades a vender.
  4. El **Encargado de Inventarios** recibe la SS, crea la **HS** final, valida stock y ejecuta la salida.
  5. Al completarse las HS que cubren la totalidad del contrato, estatus cambia a `ENTREGADO`.
- Efectos en HS/HE:
  - Las entregas se registran como HS generadas por el Encargado de Inventarios. Cada HS descuenta inventario.
  - Si hay devolución posterior, el Revisor genera una **Solicitud de Entrada (SE)** y el Encargado registra la **HE**.
- Inventario: Se descuenta al guardar HS en el módulo de inventarios; una venta completada implica que el inventario pasó del almacén al cliente.

## 3. Venta por Pérdida

- Objetivo: Registrar una venta por pérdida (cliente pierde equipo) y descontar inventario inmediatamente.
- Flujo principal:
  1. Usuario (Revisor de Contratos) crea contrato con `tipo_operacion = 'VENTA PERDIDA'`.
  2. El sistema guarda el contrato y genera automáticamente:
     - Una **HS automática** con folio `HSP-{folio_c}` (sin intervención de inventarios).
     - Una **HE automática** con folio `HEP-{folio_c}` (sin intervención de inventarios).
  3. Los `hs_items` y `he_items` son los mismos que los `contrato_items`.
  4. Al guardar ambos documentos automáticos:
     - Inventario se descuenta (HS automática).
     - Inventario se incrementa (HE automática).
     - **Neto**: el equipo queda registrado como salido (pérdida), sin cambio neto en stock pero con trazabilidad de pérdida.
  5. El estatus del contrato queda en `CERRADO` (equipo fuera de stock / pérdida registrada).
- Efectos en HS/HE:
  - HS y HE automáticas se crean en el mismo paso de creación del contrato; no interviene el Encargado de Inventarios.
- Inventario: Se registra la pérdida inmediatamente sin intervención manual de inventarios.

## 4. Venta por Solicitud del Cliente

- Objetivo: Registrar una venta por solicitud expresa del cliente (cliente solicita que se contabilice como venta, no como devolución).
- Flujo principal:
  1. Usuario (Revisor de Contratos) crea contrato con `tipo_operacion = 'VENTA POR SOLICITUD DEL CLIENTE'`.
  2. El sistema guarda el contrato y genera automáticamente:
     - Una **HS automática** con folio `HSS-{folio_c}` (sin intervención de inventarios).
  3. Al guardar la HS automática:
     - Inventario se descuenta (equipo considerado venta).
  4. El estatus del contrato queda en `CERRADO` (equipo vendido por solicitud).
- Efectos en HS/HE:
  - HS automática se crea en el mismo paso de creación del contrato; no interviene el Encargado de Inventarios.
  - No se requiere HE (es una venta, no una devolución).
- Inventario: Se registra la salida (venta) inmediatamente sin intervención manual de inventarios.

## 5. Renovación — Total

- Objetivo: Crear un nuevo contrato que renueva totalmente el anterior (misma composición y condiciones principales).
- Flujo principal:
  1. Usuario (Revisor de Contratos) crea contrato nuevo desde opción "Renovar" en contrato existente.
  2. Nuevo contrato hereda `folio_raiz` del anterior; se guarda `renta_anterior = folio_prev` y se actualiza `renta_posterior` del anterior.
  3. Items se pueden copiar tal cual; estatus del nuevo contrato inicial: `ACTIVO`.
  4. Si la renovación implica devolución del equipo anterior, el **Revisor** genera una **Solicitud de Entrada (SE)** para el contrato anterior.
  5. El **Encargado de Inventarios** ejecuta la SE y crea la **HE** correspondiente.
- Efectos en HS/HE:
  - Si la renovación continúa con el equipo ya en campo (sin devolución), no se crean solicitudes HS/HE inmediatamente; el nuevo contrato simplemente toma la continuidad de seguimiento por `folio_raiz`.
  - Si hay cambio de equipo o devolución parcial, intervienen SS y SE generadas por el Revisor, ejecutadas por Inventarios.
- Inventario: Refleja cambios según HS/HE ejecutados por Inventarios en el proceso de renovación.

## 6. Renovación — Parcial

- Objetivo: Crear un nuevo contrato que renueva parcialmente (por ejemplo, cambios en cantidades o en parte de los items).
- Flujo principal:
  1. Usuario (Revisor de Contratos) crea nuevo contrato heredando `folio_raiz` y referenciando `renta_anterior`.
  2. Se especifican diferencias (items añadidos/quedados fuera, cambios de cantidades).
  3. Si parte del equipo se devuelve, el **Revisor** genera una **Solicitud de Entrada (SE)** con las cantidades a devolver.
  4. El **Encargado de Inventarios** recibe la SE y crea la **HE** final.
  5. Si hay equipo nuevo a entregar, el **Revisor** genera una **Solicitud de Salida (SS)**.
  6. El **Encargado de Inventarios** ejecuta la SS y crea la **HS** final.
- Efectos en HS/HE:
  - Intervienen SS y SE generadas por Revisor, ejecutadas por Inventarios.
- Inventario: Refleja suma según HS/HE ejecutados por Inventarios en el proceso de renovación.

## 7. Cancelación de Contrato

- Objetivo: Cancelar un contrato antes de una entrega. Se puede presentar cuando no se lleve a cabo la operación entre las dos partes (ICAM y cliente) o cuando exista la necesidad de cambiar cantidades de equipo antes de que este sea entregado, y esta cantidad impacte de manera importante el monto de renta.
- Flujo principal:
  1. Usuario (Revisor de Contratos) solicita cancelación.
  2. En caso de que la cancelación se de por cambios importantes en cuanto a montos o cantidades de equipo, se cancelara el contrato y se generará uno nuevo acorde al equipo que se requiera. Es importante aclarar que esta operación solo se puede ejecutar siempre y cuando no existan entregas previas.
- Efectos en HS/HE:
  - No se generan HS por la cancelación misma.

## 8. Cancelación por Solicitud Expresa del Cliente

- Objetivo: Registrar la cancelación de un contrato motivada por solicitud expresa del cliente, ya sea porque ICAM no pudo entregar el equipo en las condiciones, cantidades o tiempos acordados (causa logística de ICAM), o porque el cliente —por motivos ajenos a ICAM— decide no aceptar los términos y condiciones de un equipo ya entregado. En ambos escenarios la cancelación es formal, genera documentación completa y conlleva la devolución del importe del contrato.
- Precondiciones:
  - Contrato existente en cualquier estado (puede haber o no equipo entregado).
  - Causa de cancelación documentada: falla logística de ICAM o rechazo del cliente por causas propias.
- Responsables principales:
  - **Revisor de Contratos**: registra la cancelación, genera SS, SE, HS y HE automáticas.
  - **Área Financiera / Administración**: gestiona la devolución del importe del contrato.
- Flujo principal:
  1. Usuario (Revisor de Contratos) selecciona el contrato y elige la opción `"Cancelación por Solicitud Expresa del Cliente"`.
  2. El Revisor documenta la causa:
     - `LOGISTICA_ICAM`: ICAM no entregó en las condiciones, cantidades o tiempos acordados.
     - `RECHAZO_CLIENTE`: el cliente, por motivos propios, decide no aceptar los términos de un equipo ya entregado.
  3. El sistema guarda el contrato con `tipo_operacion = 'CANCELACION EXPRESA CLIENTE'` y genera automáticamente los cuatro documentos:
     - Una **SS automática** con folio `SSC-{folio_c}` (solicitud de salida asociada a la cancelación).
     - Una **SE automática** con folio `SEC-{folio_c}` (solicitud de entrada / devolución del equipo).
     - Una **HS automática** con folio `HSC-{folio_c}` (hoja de salida; registra el movimiento de equipo involucrado).
     - Una **HE automática** con folio `HEC-{folio_c}` (hoja de entrada; documenta la reincorporación del equipo al almacén).
  4. Los ítems de SS, SE, HS y HE automáticas corresponden a los `contrato_items` del contrato cancelado.
  5. El estatus del contrato pasa a `CANCELADO`.
  6. El sistema genera una notificación/alerta al **Área Financiera** para iniciar el proceso de devolución del importe del contrato al cliente.
  7. Una vez confirmada la devolución del importe, se registra el cierre financiero en el contrato (campo `devolucion_confirmada = true` y fecha de devolución).
- Efectos en HS/HE y solicitudes:
  - SS, SE, HS y HE automáticas se crean en el mismo paso de registro de la cancelación; no requieren intervención del Encargado de Inventarios.
  - El inventario se actualiza de forma inmediata conforme a los documentos automáticos (HS descuenta, HE incrementa según el estado del equipo).
- Inventario:
  - Si el equipo nunca fue entregado: la HS y HE automáticas registran el movimiento en cero o con las cantidades afectadas, manteniendo trazabilidad sin alterar stock neto.
  - Si el equipo ya había sido entregado y el cliente lo rechaza: la HE automática incrementa el stock al reincorporar el equipo devuelto.
- Devolución del importe:
  - La cancelación siempre genera la obligación de devolver el importe pagado por el cliente.
  - El proceso de devolución es gestionado por el Área Financiera / Administración fuera del módulo de contratos, pero queda registrado en el contrato como campo de confirmación.
- Notas:
  - Este caso de uso es distinto a la **Cancelación de Contrato** (caso 7), que aplica únicamente antes de cualquier entrega y no genera documentos automáticos.
  - Aplica tanto si hay entregas previas como si no las hay, siendo el factor diferenciador la solicitud expresa del cliente como motivo.
  - Toda cancelación de este tipo debe quedar trazable con causa, fecha y responsable para efectos de auditoría.

## 9. Cierre / Recolectado (Fin de Contrato de Renta)

- Objetivo: Registrar la devolución total de equipo y cerrar el contrato.
- Flujo principal:
  1. Usuario (Revisor de Contratos) genera una **Solicitud de Entrada (SE)** con los items y cantidades esperadas a devolver.
  2. Usuario (Encargado de Inventarios) recibe la SE, crea la **HE** final con las cantidades reales recibidas.
  3. Al confirmar la HE, el inventario se incrementa (`stock_disponible += cantidad`), y el contrato pasa a `RECOLECTADO` si todas las piezas están devueltas.
  4. Si faltan piezas, el contrato puede quedar en `ENTREGA PARCIAL` o generar acciones por pérdida.
- Efectos en HS/HE:
  - La SE es generada por el Revisor; la HE final es registrada por el Encargado de Inventarios y es la que actualiza inventario hacia adentro.

## 10. Registro de Solicitud de Salida (SS) — Operación común (Revisor de Contratos)

- Objetivo: Generar una solicitud de entrega de material asociada a un contrato.
- Responsable: **Revisor de Contratos**.
- Flujo principal:
  1. Revisor abre panel SS para `folio_c` y obtiene referencia de `contrato_items`.
  2. El sistema muestra información de referencia: `cantidad contrato | ya entregado | pendiente`.
  3. Revisor ingresa cantidades a solicitar y genera la SS.
  4. Al guardar la SS:
     - Se crea un registro de solicitud con estado `PENDIENTE` (awaiting inventory).
     - El inventario no cambia aún.
  5. La SS es visible para el **Encargado de Inventarios** en su panel de HS.
- Inventario: Sin cambios en esta etapa.

## 11. Registro de HS (Hoja de Salida) — Operación común (Encargado de Inventarios)

- Objetivo: Ejecutar una solicitud de salida y documentar la salida física de material.
- Responsable: **Encargado de Inventarios**.
- Flujo principal:
  1. Encargado de Inventarios abre panel HS y filtra por SS pendientes o crea HS directamente si aplica.
  2. El sistema obtiene `stock_map`, `contrato_items` referencia y `hs_items` ya existentes (batch).
  3. El sistema muestra badges: `stock disponible | cantidad contrato | ya entregado | pendiente`.
  4. Encargado valida cantidades contra stock disponible.
  5. Al guardar la HS (POST `ops_hs` y `ops_hs_items`):
     - La SS asociada cambia a estado `EJECUTADA` (si existe).
     - Inventario se reduce (`stock_disponible -= cantidad_entregada`).
     - Se recalcula el `estatus` del contrato: si `totalEnviado >= totalContrato` → `ACTIVO`; si `<` → `ENTREGA PARCIAL`.
- Inventario: Se descuenta al guardar HS.

## 12. Registro de Solicitud de Entrada (SE) — Operación común (Revisor de Contratos)

- Objetivo: Generar una solicitud de recolección/devolución de material asociada a un contrato.
- Responsable: **Revisor de Contratos**.
- Flujo principal:
  1. Revisor abre panel SE para `folio_c`.
  2. El sistema muestra referencia de `contrato_items` y equipo ya entregado.
  3. Revisor ingresa cantidades a recolectar y genera la SE.
  4. Al guardar la SE:
     - Se crea un registro de solicitud con estado `PENDIENTE` (awaiting inventory).
     - El inventario no cambia aún.
  5. La SE es visible para el **Encargado de Inventarios** en su panel de HE.
- Inventario: Sin cambios en esta etapa.

## 13. Registro de HE (Hoja de Entrada) — Operación común (Encargado de Inventarios)

- Objetivo: Ejecutar una solicitud de entrada y documentar la recolección/devolución de material.
- Responsable: **Encargado de Inventarios**.
- Flujo principal:
  1. Encargado de Inventarios abre panel HE y filtra por SE pendientes o crea HE directamente si aplica.
  2. El sistema obtiene `contrato_items` referencia y `he_items` ya existentes (batch).
  3. Encargado ingresa las cantidades reales recibidas (pueden diferir de la solicitud si hay pérdidas parciales).
  4. Al guardar la HE (POST `ops_he` y `ops_he_items`):
     - La SE asociada cambia a estado `EJECUTADA` (si existe).
     - Inventario se incrementa (`stock_disponible += cantidad_devuelta`).
     - Si todas las piezas del contrato están recolectadas, el `estatus` pasa a `RECOLECTADO`.
     - Si hay diferencias, se generan notas o excepciones para auditoría.
- Inventario: Se incrementa al guardar HE.

## 14. Cambio de Equipo

- Objetivo: Realizar un cambio de elementos específicos del equipo enviado (por solicitud del cliente o por error en el despacho inicial).
- Precondiciones: Contrato de renta o venta activo con equipo ya entregado; equipo a cambiar identificado; equipo de reemplazo disponible en almacén.
- Responsables principales:
  - **Agente de Ventas**: genera la solicitud de cambio (especifica qué devolver y qué reemplazar).
  - **Revisor de Contratos**: recibe la solicitud, **no modifica el contrato original**, genera:
    - **Solicitud de Entrada (SE)** con los items a devolver.
    - **Solicitud de Salida (SS)** con los items de reemplazo.
  - **Encargado de Inventarios**: ejecuta la SE y la SS, registrando:
    - **HE** para el equipo devuelto (incrementa stock).
    - **HS** para el equipo enviado (decrementa stock).
- Flujo principal:
  1. Agente de Ventas abre el contrato y genera una solicitud de cambio (especificando código original, cantidad, motivo, código de reemplazo).
  2. Revisor de Contratos valida la solicitud y genera:
     - Una **SE** con los items a devolver (folio `SE-xxx`).
     - Una **SS** con los items a entregar (folio `SS-xxx`).
     - Ambas solicitudes quedan vinculadas al contrato pero **sin modificarlo**.
  3. Encargado de Inventarios recibe las solicitudes:
     - Crea una **HE** que registra la devolución (incrementa stock del equipo devuelto).
     - Crea una **HS** que registra la salida del reemplazo (decrementa stock del nuevo equipo).
  4. El contrato mantiene sus términos originales; el cambio es registrado como un evento dentro del historial de movimientos.
- Efectos en HS/HE:
  - Se generan una SE y una SS (por el Revisor).
  - Se ejecutan una HE y una HS (por Inventarios).
  - El contrato no se modifica; solo se registran los movimientos asociados.
- Inventario:
  - Stock del equipo devuelto: se incrementa (HE).
  - Stock del equipo enviado: se decrementa (HS).
- Notas:
  - El sistema debe permitir generar múltiples cambios sobre un mismo contrato.
  - Cada cambio genera una dupla SE-SS vinculada y trazable.
  - No se crea nuevo contrato; es un movimiento dentro del contrato vigente.

## 15. Renovación de dos o más contratos en uno solo

- Objetivo: Unificar la renovación de dos o más contratos activos que vencen dentro de una ventana =<7 días naturales, consolidando items en un solo contrato de renovación.
- Precondiciones:
  - Dos o más contratos de renta vigentes para el mismo cliente.
  - Vencimiento de cada contrato dentro de una ventana =<7 días naturales.
  - Equipo de ambos/todos los contratos sigue en obra (sin devolución previa).
- Responsables principales:
  - **Revisor de Contratos**: analiza contratos próximos a vencer, genera el contrato de renovación unificado.
- Flujo principal:
  1. Revisor identifica contratos con vencimiento en ventana de 7 días (ej: contrato A vence 15-05, contrato B vence 20-05).
  2. Revisor crea un **nuevo contrato de renovación** que:
     - Toma los items de ambos contratos A y B (consolidados).
     - Genera un único `folio_raiz_nuevo` para la renovación unificada.
     - Establece referencias:
       - Contrato A: `renta_anterior = folio_A`, `renta_posterior = folio_renovacion_nueva`.
       - Contrato B: `renta_anterior = folio_B`, `renta_posterior = folio_renovacion_nueva`.
       - Contrato nuevo: `folio_raiz = folio_renovacion_nueva` (puede heredar parcialmente de A o B, o generarse único).
  3. **No se generan SE ni SS**: el equipo permanece en obra, cambiando únicamente la referencia contractual.
  4. Los contratos originales (A y B) cambian estado a `RENOVADO`.
  5. El nuevo contrato inicia en estado `ACTIVO`.
- Efectos en HS/HE:
  - **No se generan solicitudes ni hojas** (SE, SS, HE, HS): el equipo permanece físicamente en obra.
  - Solo hay cambios administrativos (vínculo contractual).
- Inventario:
  - Sin cambios: el equipo no se mueve físicamente.
- Notas:
  - Sistema debe permitir identificar y sugerir contratos candidatos a unificación (criterio: mismo cliente, vencimiento ±7 días).
  - La renovación unificada hereda las condiciones principales de ambos contratos (tarifas, términos).
  - Es fundamental mantener trazabilidad: los contratos originales deben quedar vinculados como "renovado en" para auditoría.
  - El equipo entregado bajo los contratos A y B sigue siendo válido bajo el nuevo contrato unificado.

---

## Resumen de reglas clave (rápido)

- `folio_c`: secuencia entera (20001, 20002...); generado al crear contrato.
- **SS (Solicitud de Salida)**: folio secuencial `SS-xxx`; generada por Revisor de Contratos (también en cambios de equipo). SS automática para `'CANCELACION EXPRESA CLIENTE'` con folio `SSC-{folio_c}`.
- **HS (Hoja de Salida)**: folio secuencial `HS-xxx`; generada por Encargado de Inventarios. HS automática para `'VENTA PERDIDA'` (`HSP-{folio_c}`), `'VENTA POR SOLICITUD DEL CLIENTE'` (`HSS-{folio_c}`) y `'CANCELACION EXPRESA CLIENTE'` (`HSC-{folio_c}`).
- **SE (Solicitud de Entrada)**: folio secuencial `SE-xxx`; generada por Revisor de Contratos (también en cambios de equipo). SE automática para `'CANCELACION EXPRESA CLIENTE'` con folio `SEC-{folio_c}`.
- **HE (Hoja de Entrada)**: folio secuencial `HE-xxx`; generada por Encargado de Inventarios para recolecciones. HE automática para `'VENTA PERDIDA'` (`HEP-{folio_c}`) y `'CANCELACION EXPRESA CLIENTE'` (`HEC-{folio_c}`).
- **Inventario**: HS resta stock; HE suma stock. SS y SE no afectan inventario (son solicitudes).
- **Renovaciones**: deben propagar `folio_raiz` y mantener referencias `renta_anterior` / `renta_posterior`.
  - **Renovación unificada**: si dos o más contratos vencen ±7 días, pueden unificarse en un solo contrato sin generar SE/SS/HE/HS (equipo permanece en obra).
- **Cambio de equipo**: genera una dupla SE-SS (Revisor) ejecutada con HE-HS (Inventarios); el contrato original no se modifica.
- **Cancelación expresa del cliente**: genera SS, SE, HS y HE automáticas (`SSC`, `SEC`, `HSC`, `HEC`) y obliga a devolución del importe del contrato. Aplica con o sin entregas previas.
- **Responsabilidades**: Revisor de Contratos genera solicitudes (SS, SE, cambios) y documentos automáticos (pérdidas, cancelación expresa). Encargado de Inventarios ejecuta solicitudes generando HS/HE finales.

---

Archivo generado a partir del contexto del proyecto ICAM 360. Revisar y ajustar etiquetas de estatus o flujos según reglas de negocio locales.
