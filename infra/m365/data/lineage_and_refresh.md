# Linaje de datos y cronograma de refresh (sugerido)

Objetivo
- Definir flujo lógico de datos desde origen (SharePoint/Graph) hasta Power BI y proponer frecuencias de refresh alineadas con coste/latencia.

Flujo (linaje)
1. SharePoint lists / document libraries (source)
   -> 2. ETL (Graph API client) extrae y escribe raw files en ADLS/Blob (landing)
   -> 3. Transform jobs (batch/ADF/Databricks/Python) procesan raw -> curated (parquet/delta)
   -> 4. Dataflows / Synapse views / SQL tables exponen datos curados
   -> 5. Power BI datasets (PBIX) consumen las entidades y publican reports

Trazabilidad / metadatos
- Registrar metadata en cada paso: source_query, extract_timestamp, row_count, file_path, watermark
- Mantener un catálogo sencillo (por ejemplo un CSV/SQL table con ejecuciones recientes) para facilitar debugging

Refresh schedules (sugerido)
- Consideraciones: tipo de dato, coste y necesidad de frescura

Categorías y frecuencias
1) Critical/Operational (ej: casuística de incidencias, tickets, listado de tareas) -> Near real-time / cada 15-30 min
- Pattern: delta endpoints + micro-batches
- Método: ADF scheduled pipeline o Function + EventGrid (si se requiere reacción por evento)

2) Business daily (ej: report diario de documentos, inventario de sitios) -> Daily (configurable entre 01:00-05:00)
- Pattern: full/partitioned hourly/daily loads
- Método: ADF daily job que actualiza particiones y triggers dataflow refresh

3) Enrichment / Master data (Users, Sites metadata) -> Weekly
- Pattern: bajas frecuentes; actualizar semanalmente o bajo demanda

4) Historical backfills -> Manual/As-needed

Power BI dataset refresh
- Triggers: cuando los artefactos curados cambian, programar el refresh del dataset via Power BI REST API
- Sugerencia: después de pipeline de curado, llamar al API de Power BI para refrescar datasets relacionados (o programar refresh programáticamente)

Monitoreo y alertas
- Registrar fallos de pipeline y enviar notificacions (Teams/Email)
- Métricas mínimas: éxito/fallo por ejecución, duración, rows processed, bytes written

SLA y recomendaciones
- SLAs deben pactarse con stakeholders. Ejemplo: Informes críticos deben reflejar datos con latencia menor a 30 minutos durante horario laboral.
- Considerar coste: refresh frecuentes en Power BI incrementan coste (especialmente en capacidad compartida)

Documentos relacionados
- infra/m365/data/etl/README.md — cómo ejecutar scripts de extracción
- infra/m365/data/model.md — mapeo y claves para incremental
