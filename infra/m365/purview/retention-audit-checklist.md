# Políticas de retención y auditoría - Plantillas y checklist

Este archivo contiene plantillas de políticas de retención y una lista de verificación para monitoreo y cumplimiento.

## Plantilla de política de retención (ejemplo)
- Nombre: Retención_Documentos_Confidenciales
- Alcance: SharePoint sites: /sites/contoso-projects/*, OneDrive for Business
- Etiquetas de sensibilidad aplicables: Confidencial, Altamente confidencial, Restringido
- Tipo de acción: Retener (no eliminar) durante 5 años desde la última modificación
- Disposición: Revisión manual por el equipo legal al expirar
- Excepciones: Documentos sujetos a retención legal (Legal Hold) se mantienen hasta liberación
- Notas: Registrar motivo y propietario de la política

## Plantilla de política de retención corta (Ej.: Logs)
- Nombre: Retención_Logs_Operativos
- Alcance: Teams chats y canales, Mailboxes
- Acción: Eliminar automáticamente a los 365 días
- Revisión: Revisión anual por Infraestructura

## Checklist de auditoría y monitoreo (operativa)
1. Habilitar Unified Audit Log y confirmar ingestión en SIEM (Microsoft Sentinel)
2. Verificar que las etiquetas de sensibilidad aparecen en los reportes de "Content explorer" de Purview
3. Confirmar que las reglas DLP están en modo 'Audit' durante el piloto
4. Confirmar notificaciones al usuario final cuando se detecten violaciones (DLP user notifications)
5. Validar que todos los reportes de incidentes DLP generan tickets/alertas en el sistema de incidentes
6. Revisar semanalmente: top 20 alertas DLP, falsos positivos, y ajustes de umbral
7. Revisar mensualmente: usuarios con más bloqueos, patrones de fuga de datos
8. Ejecutar muestreo trimestral: buscar PII/PHI en repositorios y SharePoint (scans programados)
9. Mantener inventario de etiquetas y reglas en el repositorio (este directorio) con versión y changelog
10. Pruebas anuales: ejercicios de eDiscovery simulados para confirmar retención y preservación

## Logs y retención de auditoría
- Conservar logs de auditoría al menos 1 año en servicios de seguridad (más si regulaciones lo requieren).
- Guardar snapshots mensuales de métricas de DLP para auditoría y evidencias de cumplimiento.

## Roles sugeridos
- Data Owner: define la clasificación y retención
- Data Steward: ejecuta etiquetado y revisiones periódicas
- Security/IR: responde incidentes DLP
- Legal: gestiona retenciones legales y eDiscovery

## Notas finales
- Alinear retenciones con requisitos regulatorios locales (GDPR, HIPAA, normativas locales)."}