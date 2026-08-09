Power Automate — Flujos de ejemplo

Este archivo describe flujos de ejemplo incluidos en docs/m365-adoption/flows. Son plantillas base que deben ajustarse a URLs, IDs de sitios, y conexiones de la organización.

Flujos incluidos:

1) notify-on-new-doc.flow.json
- Escenario: cuando se crea o modifica un documento en la biblioteca de SharePoint de un Team, enviar una notificación al canal de Teams correspondiente y copiar metadata a una lista de inventario.
- Componentes: Trigger: When a file is created or modified (SharePoint). Actions: Get file metadata, Post message in a channel (Microsoft Teams), Create item (SharePoint list), condicionales según metadata.

2) escalate-issue.flow.json
- Escenario: seguimiento de issues/incidentes en una lista de SharePoint. Si un issue no cambia de estado en X horas o está marcado como crítico, crear una tarea en Planner, notificar a Owner y escalar por correo a manager.
- Componentes: Trigger: When an item is created or modified (SharePoint). Actions: Condition (status/timestamp), Delay/Recurrence para chequeo, Create task (Planner), Post message (Teams), Send email (Office 365 Outlook).

Cómo desplegar
1. Abrir Power Automate -> My flows -> Import
2. Crear conexiones requeridas (SharePoint, Teams, Planner, Office 365 Outlook)
3. Ajustar siteId, listId, channelId y nombres de columnas
4. Probar en entorno piloto

Notas de seguridad
- Usar conexiones de servicio con cuentas con permisos mínimos necesarios
- Restringir triggers que expongan datos sensibles

Ver las definiciones JSON en el directorio flows/ para importar directamente en Power Automate (Import -> Zip de paquete o usar REST API para crear flow).