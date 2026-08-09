# Taxonomía de etiquetas de sensibilidad (Microsoft Purview / M365)

Este documento propone una taxonomía de etiquetas de sensibilidad, alineada con las clases de datos detectables en este repositorio (ejemplos: inventarios CSV, scripts de provisión, documentación de proyecto). Incluye descripción, acciones recomendadas, y ejemplos de disparadores automáticos.

## Etiquetas (ordenadas de menor a mayor sensibilidad)

1) Publico
- Color: Gris claro
- Descripción: Información aprobada para publicación pública.
- Marcas visuales: Ninguna obligatoria.
- Protección recomendada: Ninguna.
- Retención/Discovery: Sin restricciones.
- Ejemplos en repo: README.md, docs sin datos de usuarios.
- Reglas automáticas: Archivos en carpetas públicas/documentación del sitio.

2) Interno
- Color: Azul
- Descripción: Información para uso interno de la organización.
- Marcas visuales: Texto "Interno" en encabezado del documento.
- Protección recomendada: Etiquetado visual; cifrado opcional.
- Retención: Permitir eliminación por usuarios.
- Ejemplos en repo: Documentos de diseño, notas de planificación.
- Reglas automáticas: Contenido en repos privados o carpetas internas.

3) Confidencial
- Color: Amarillo
- Descripción: Información que contiene PII mínima o detalles operativos internos.
- Protección recomendada: Cifrado en tránsito y reposo; aplicar DLP para prevenir exfiltración.
- Retención: 3-7 años según regulaciones.
- Ejemplos en repo: SIGE-M365-Integration-Inventory.csv (puede contener correos y nombres), scripts que referencia credenciales (placeholders).
- Reglas automáticas: Coincidencia de tipos sensibles: direcciones de correo, NIF/CUIT local, números de teléfono.

4) Altamente confidencial (PII)
- Color: Naranja
- Descripción: Datos personales identificables sensibles (PII) en cantidad o contexto que requieren protección fuerte.
- Protección recomendada: Cifrado obligatorio, acceso restringido solo a grupos autorizados, registro de acceso (audit logging), marca visual "Contiene PII".
- Retención: Según requisitos legales (variable). El borrado seguro debe ser posible.
- Ejemplos en repo: Inventarios o CSV con columnas de nombre, apellido, email, documento de identidad; muestras de datos de prueba con datos reales.
- Reglas automáticas: Coincidencia de patrones de documento de identidad, múltiples direcciones de correo, combinaciones nombre+apellido+documento.

5) Restringido / PHI / PCI
- Color: Rojo
- Descripción: Información que contiene datos de salud (PHI), financieros (PCI), o secretos de seguridad (credenciales/llaves privadas).
- Protección recomendada: Máxima (encryption with customer-managed keys), acceso por justificación, revisión manual antes de compartir, bloqueo de exfiltración.
- Retención: Seguir requisitos regulatorios estrictos.
- Ejemplos en repo: Cualquier archivo que contenga claves privadas, secretos, o muestras de registros médicos (no deberían estar en el repo). Scripts de provisión que incluyan APP IDs o cadenas similares deben tratarse como sospecha hasta validar.
- Reglas automáticas: Detección de números de tarjeta, términos médicos combinados con datos identificables, patrones de claves privadas (BEGIN RSA PRIVATE KEY), cadenas que coincidan con patrones de secretos (bearer tokens, connection strings).

---

## Mapeo de etiquetas a acciones automáticas (recomendación)
- Publico: Sin acciones.
- Interno: Aplicar marca visual y seguimiento en logs.
- Confidencial: Aplicar etiqueta, cifrado opcional, recomendar DLP notificación al usuario al compartir externamente.
- Altamente confidencial: Forzar cifrado, bloquear compartición externa por defecto, crear incidente para revisores.
- Restringido: Bloquear compartición externa, requerir revisión y aprobación, activar eDiscovery preservación cuando sea necesario.

---

## Notas prácticas
- Empiece con etiquetado manual y reglas de prueba (simulate mode) antes de imponer bloqueo automático.
- Proporcione formación y mensajes contextuales al usuario cuando una regla DLP detecte datos sensibles ("Este archivo parece contener PII: ¿desea etiquetarlo como Altamente confidencial?").
- Mantener un inventario de tipos sensibles esperados por sistema (ver infra/m365/purview/dlp-rules-templates.md).