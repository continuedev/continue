Instrucciones para migración/sincronización y control de acceso (RAG pilot)

Resumen
------
Guía para migrar contenido existente a la nueva estructura RAG en SharePoint y recomendaciones para el control de acceso. No ejecutar sin pruebas en un tenant de staging.

1) Inventario y preparación
--------------------------
- Identificar orígenes: file shares, repositorios, correos, Confluence, servicios externos.
- Clasificar contenidos candidatos (por owner, sensibilidad, tamaño, formato).
- Identificar los grupos de Azure AD que deben recibir acceso (Owners, Members, Visitors).
- Mapear metadatos actuales a los campos RAG* definidos en taxonomy.md.

2) Selección de herramienta de migración
---------------------------------------
Opciones recomendadas:
- SharePoint Migration Tool (SPMT) — recomendado para file shares y migraciones grandes, soporta preservación de metadatos básicos.
- Mover / Microsoft 365 migration APIs — para migraciones a escala o cross-tenant.
- PnP.PowerShell — recomendado para pequeños lotes, automatización de metadata y validaciones post-migración.

3) Migración con PnP.PowerShell (ejemplo)
-----------------------------------------
- Escenario: migrar un conjunto de archivos de una carpeta local a la biblioteca RAG-Source-Docs y asignar metadatos.

Ejemplo (no ejecutar sin revisar):

Connect-PnPOnline -Url https://contoso.sharepoint.com/sites/rag-pilot -Interactive
$localPath = 'C:\migracion\bucket1'
$targetList = 'RAG-Source-Docs'

Get-ChildItem -Path $localPath -Recurse -File | ForEach-Object {
    $relPath = $_.FullName
    $upload = Add-PnPFile -Path $relPath -Folder $targetList -Values @{
        'RAGSourceSystem' = 'FileShare'
        'RAGSourceId' = [System.Guid]::NewGuid().ToString()
        'RAGOwner' = 'owner@contoso.com'
        'RAGClassification' = 'Internal'
    }
    Write-Host "Uploaded: $($_.Name)"
}

- Notas:
  - Use Add-PnPFile/Add-PnPFolder para preservar estructura.
  - Para archivos grandes o alto throughput prefiera SPMT.
  - Después de upload, ejecute validaciones para garantizar metadatos y permisos.

4) Sincronización incremental y triggers
----------------------------------------
- Usar Microsoft Graph change notifications (delta queries or webhooks) para detectar cambios y disparar re-index.
- Alternativa: Programar un job (Azure Function/Logic App) que consulte documentos con RAGEmbeddingStatus=pending y los procese.

5) Control de acceso y políticas
-------------------------------
- Crear grupos Azure AD por rol: rag-pilot-owners, rag-pilot-members, rag-pilot-visitors.
- Asignar grupos a roles de sitio (Owners, Members, Visitors) — administrar permisos a nivel de sitio o biblioteca, evitar item-level permissions cuando sea posible.
- Sensitivity labels / Purview:
  - Definir etiquetas de sensibilidad y políticas de retención en Purview. Estas se aplican a archivos y/o sitios.
  - Automatizar etiquetado cuando sea posible (Auto-labeling policies) y documentar las excepciones.
- Acceso externo: Bloquear o aprobar external sharing a nivel de site policy según clasificación.

6) Auditoría y monitoreo
-------------------------
- Habilitar auditoría en Purview / Microsoft 365 para seguir accesos y cambios.
- Monitorizar ingestion pipeline: tasas de fallo (RAGEmbeddingStatus=failed), latencia de indexación, números de items pendientes.

7) Pruebas y validación
-----------------------
- Pruebe con un subset representativo (formatos y tamaños).
- Validar:
  - Integridad de contenido
  - Mapeo de metadatos
  - Permisos y acceso
  - Workflows de re-indexación

8) Rollout y operaciones
------------------------
- Plan de rollback: mantener snapshot de origen hasta validación completa.
- Documentar SLA de ingestion (ej: 24h para contenido nuevo)
- Equipo responsable: Lista de owners para soporte y curación de taxonomy

Ejemplos y scripts adicionales
-----------------------------
- El script PnP en infra/m365/create-sharepoint-site.ps1 provee provisión de librerías y site columns.
- Para migraciones masivas, usar SPMT con un csv mapping y luego ejecutar jobs PnP para fijar metadatos más avanzados y crear items en RAG-Processed-Chunks.

Contacto
--------
Equipo SigE / M365: m365-team@contoso.com (ajustar según tenant)

