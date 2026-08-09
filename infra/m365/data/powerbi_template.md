# Power BI: plantilla y guidance (dataflows / PBIX)

Objetivo
- Dar opciones para enlazar los datos extraídos desde SharePoint/Graph a Power BI Service: 1) Dataflows en Power BI (con ADLS/Blob como sink), 2) PBIX que consuma un data lake o consulte Graph directamente (no recomendado para grandes volúmenes).

Recomendaciones arquitectónicas
1) Landing / Raw zone (ADLS/Blob)
- Formato: parquet / csv
- Organización: /m365/sites/, /m365/drives/, /m365/documents/, /m365/lists/, /m365/listitems/, /m365/users/, /m365/activity/
- Ingesta: ETL/ELT escribe archivos particionados por fecha (p. ej. year=YYYY/month=MM/day=DD)

2) Curated / Model zone
- Tablas transformadas y con tipos adecuados (parquet or Delta if Delta Lake available)
- Exponer mediante dataflows o Azure Synapse serverless SQL views para que Power BI las consuma

3) Power BI artifacts
- Dataflows (Power BI Service)
  - Crea una entidad por tabla de modelo curado (Sites, Documents, ListItemsEnriched...).
  - Ventaja: reutilización entre datasets y ETL fuera de PBIX.
  - Conector: Azure Data Lake Storage Gen2, o HTTP/REST con paginación si consume API directamente.

- PBIX (semantic model)
  - Crear modelo tabular con relaciones entre las tablas del modelo propuesto.
  - Aplicar medidas y columnas calculadas en el modelo, no en los reports cuando sea posible.
  - Activar incremental refresh en tablas grandes (Documentos, ListItems) usando columna datetime (LastModifiedDateTime).

Power BI Dataflow (ejemplo de pasos)
1. Crear workspace con capacidad Premium o por usuario según requerimientos (incremental refresh en Dataflows requiere capacidades específicas).
2. Crear Dataflow -> Conectar a ADLS Gen2 -> apuntar a contenedor/carpeta raw o curated.
3. Mapear esquema y transformar en Power Query, guardando en entity (parquet o CDM format).
4. Usar el dataflow como dataset de origen para PBIX (Get Data -> Power BI Dataflows).

PBIX Template (recomendaciones rápidas)
- Tablas a incluir: Sites, Libraries, Documents, Users, ListItemsEnriched, ActivityEvents
- Relaciones:
  - Sites.SiteId = Libraries.SiteId
  - Libraries.LibraryId = Documents.DriveId
  - Sites.SiteId = ListItemsEnriched.SiteId
  - Users.UserId = Documents.CreatedBy / ListItemsEnriched.CreatedBy
- Performance:
  - Reducir columnas cargadas a las estrictamente necesarias.
  - Usar star-schema cuando introduzca hechos y dimensiones (ej: ActivityEvents como fact, Users/Sites como dims).
  - Comprimir columnas de texto largas y usar relaciones en lugar de repetición.

Incremental refresh (PBIX)
- Requisitos: columna datetime para watermark (ej. LastModifiedDateTime)
- Partitions: RangeStart/RangeEnd parameters en Power Query y habilitar Incremental Refresh en la tabla (p. ej. refrescar 7 días incremental + 5 años histórico completo)

Seguridad y gobernanza
- Row-level security si los reportes requieren acceso restringido
- Datos sensibles: masking o datasets filtrados por entorno
- Auditar accesos al storage y al Power BI workspace

Ejemplo de mapping para un Dataflow (pseudo steps)
- Source: /m365/documents/year=2026/month=08/
- Transform: parse datetime columns, cast sizes a integer, normalize user principal names a UserId via lookup to Users entity
- Sink: entity DocumentsCurated

Notas finales
- Para volúmenes pequeños (<50k items) se puede consultar Graph desde Power Query pero recomendamos centralizar en data lake para trazabilidad y performance.
