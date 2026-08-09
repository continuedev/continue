Plantilla de Dashboard Power BI para seguimiento de adopción M365

Objetivo
Dashboard para visualizar KPIs de adopción en un único panel, con filtros por unidad de negocio, región y periodo.

Datasets sugeridos
- Teams usage (Graph API): teams_active_30d, messages_per_user, meetings_count
- SharePoint usage: docs_created, docs_modified, coauthoring_events
- Power Automate: flows_count, flows_failures
- Inventory: teams_inventory (teamId, owner, classification)

Data model
- Tabla central: Date
- Dimensiones: Team, User, Region, BusinessUnit, SensitivityLabel
- Hechos: TeamsUsage, SharePointUsage, FlowsUsage, PlannerTasks

Visualizaciones clave
- KPI cards: Usuarios activos 7d/30d, Teams activos 30d, Flujos fallidos (7d)
- Tendencia: Usuarios activos por semana (line)
- Distribución por BU: Teams activos por unidad (bar)
- Calidad: % equipos sin owner, documentos sin metadata (gauge)
- Automatizaciones: top 10 flujos por número de ejecuciones y errores

Medidas DAX de ejemplo
- UsuariosActivos30d = CALCULATE(DISTINCTCOUNT(TeamsUsage[UserId]), DATESINPERIOD(Date[Date], MAX(Date[Date]), -30, DAY))
- TeamsActivos30d = CALCULATE(DISTINCTCOUNT(TeamsUsage[TeamId]), DATESINPERIOD(Date[Date], MAX(Date[Date]), -30, DAY))

Implementación
1. Crear dataset en Power BI Desktop conectando a fuentes: Graph API export, logs o tablas en SharePoint/SQL.
2. Construir modelo, crear medidas DAX y diseñar report.
3. Publicar a Power BI Service y configurar refresh diario.
4. Compartir app o workspace con stakeholders y programar alertas para KPIs críticos.

Archivo de ejemplo
- No se incluye PBIX binario en repo. Use este documento como guía para crear el .pbix y versionar un archivo de definición (README + DAX) en el repositorio.

Siguientes pasos
- Mapear fuentes disponibles en la organización y crear pipelines ETL para normalizar datos (Power Automate, Logic Apps, Azure Functions o Power Query).