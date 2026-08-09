# Infra: M365 Data - Power BI pipelines

Resumen
- Objetivo: artefactos y ejemplos para extraer datos desde SharePoint (Graph API) y alimentar Power BI (Dataflows / PBIX / ADLS). Solo artefactos: modelos, scripts y documentación. No se provisiona nada.

Contenido
- model.md — modelo semántico inicial y mapeo desde listas/libraries de SharePoint
- powerbi_template.md — plantilla / guidance para crear dataflows o PBIX y recomendaciones de modelado
- lineage_and_refresh.md — linaje de datos esperado y calendarios de refresh sugeridos
- etl/README.md — instrucciones y requisitos para los scripts de ejemplo
- etl/sharepoint_graph_to_blob.py — script Python ejemplo: extrae de Microsoft Graph, transforma y carga a Azure Blob/ADLS (parquet)

Convenciones
- Todos los scripts usan variables de entorno o placeholders para credenciales (NO incluir secretos en el repo).
- El modelo propuesto es inicial y puede ampliarse según el inventario real de listas y bibliotecas.

Siguientes pasos sugeridos
1. Revisar mapeo con el equipo de producto para ajustar tablas y campos.
2. Validar permisos de App Registration (Sites.Read.All o Delegated según el escenario).
3. Probar scripts en sandbox y crear dataflows en Power BI Service apuntando a los datasets en ADLS/Blob o a API directamente.
