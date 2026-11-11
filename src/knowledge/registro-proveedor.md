# Registro como proveedor: conocimiento operativo

## Flujo determinista

1. Leer solicitud, descriptor y soportes exigidos.
2. Mapear cada etiqueta usando el glosario y el maestro.
3. Clasificar el campo como `lleno`, `faltante` o `requiere_confirmacion`.
4. Generar el archivo correspondiente: XLSX, PDF o valores copiados para portal.
5. Armar el paquete y revisar soportes.
6. Pedir confirmación humana antes de simular envío.

## Reglas

- CO usa NIT. Para EC, PE y PA se pide RUC; HN pide RTN. Como el maestro solo tiene NIT colombiano, para otros países se propone ese valor con estado `requiere_confirmacion` y nota `identificador extranjero`.
- Los datos bancarios solo se incluyen cuando el descriptor los pide. Nunca se incluyen en el borrador de correo.
- Un soporte con vigencia anterior a la fecha de ejecución está vencido. Un soporte ausente o vencido bloquea `listo_para_firma`.
- `vigencia_hasta: null` significa que el fixture no informa una fecha de vencimiento; no significa que el soporte esté actualizado.
- Campos faltantes o pendientes de confirmación deben reportarse, pero no cambian por sí solos el booleano `listo_para_firma`.
- Los soportes entregados son placeholders ficticios y los documentos emitidos en Colombia pueden requerir aceptación humana de clientes extranjeros.

## Límites

El agente prepara información. No firma, no envía correos, no inicia sesión en portales, no maneja credenciales ni acciona cargas externas.