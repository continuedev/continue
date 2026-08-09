Taxonomía propuesta y esquema de metadatos para sitio piloto RAG

Resumen
-------
Documento que describe la taxonomía de sitios y el esquema de metadatos recomendado para soportar ingestion RAG (Retrieval-Augmented Generation) y discovery en SharePoint/M365.

Objetivos
- Organizar sitios para facilitar el descubrimiento por contexto y por tópico.
- Definir metadatos que faciliten: filtrado por sensibilidad, selección de fuentes, rastreo de chunks/embeddings y control de retención.
- Mantener compatibilidad con procesos de ingestión que exporten metadatos a un indexador/embedding store externo.

1) Modelo de taxonomía de sitios
-------------------------------
Propuesta jerárquica ligera (alineada con Hub sites y sitios de equipo):
- Tenant (raíz)
  - Hub site: RAG-Hub (centraliza búsqueda, navegación y políticas comunes)
    - Site collection: Project / Domain Sites (ej. PM, Legal, HR, Product)
      - Team site: Project/Feature/Equipo específico (ej. prod-search, legal-contracts)

Reglas y convenciones:
- Naming: <hub>-<domain>-<team> o "/sites/{alias}" con alias legible. Ej: /sites/rag-pilot, /sites/product-knowledge
- Cada área que vaya a ser ingested debe tener una biblioteca dedicada (o colección bien identificable) para facilitar la extracción incremental.
- Hubs agrupan sitios con políticas comunes (retención, clasificación, etiquetas de sensibilidad).

2) Contenido y bibliotecas recomendadas por sitio
------------------------------------------------
- RAG-Source-Docs: biblioteca con el contenido original (PDF, DOCX, HTML, EML)
- RAG-Processed-Chunks: biblioteca o lista que almacena chunks (por documento) con metadatos por chunk
- RAG-Embeddings-Index: biblioteca/lista que almacena metadata por documento/chunk con referencia al embedding externo (ej. externalId, vectorStoreKey)
- Shared-Resources: plantillas, glosario, reglas de chunking, stopwords

3) Esquema de metadatos (campos recomendados)
--------------------------------------------
Campos básicos (site-columns, reutilizables):
- RAGOwner (User) — persona o grupo responsable
- RAGClassification (Choice) — [Public, Internal, Confidential, Restricted]
- RAGRetentionLabel (Text) — etiqueta de retención/sensitivity (si aplica, link a Purview)
- RAGSourceSystem (Text) — origen original (SharePoint, FileShare, Email, Confluence)
- RAGSourceId (Text) — id del documento en el sistema origen
- RAGDocType (Choice) — [Policy, Contract, Spec, Ticket, Email, KnowledgeArticle, Other]
- RAGLanguage (Choice) — [en, es, pt, fr, de, other]
- RAGChunkId (Text) — identificador único para chunk
- RAGChunkOrder (Integer/Text) — orden del chunk dentro del documento
- RAGIndexedAt (DateTime) — timestamp de la última indexación/embedding
- RAGEmbeddingStatus (Choice) — [pending, processed, failed]
- RAGTopic (Managed Metadata) — término del termset RAG Topics (para clasificación semántica)
- RAGVisibility (Choice) — controls adicionales para ingestion (include/exclude)

Metadatos para gobernanza / seguridad
- SensitivityLabel (preferir etiquetas Purview) — aplicar sensibilidad a nivel de item o site
- AzureADGroup (Text) — grupo que debe tener acceso; preferir permisos a través de grupos

4) Mapeo de metadatos a procesos RAG
-----------------------------------
- Ingestor debe priorizar por RAGEmbeddingStatus = pending y por RAGLanguage.
- Sensitivity (RAGClassification / SensitivityLabel) determina redaction o exclusión de ingestion.
- RAGSourceId y RAGChunkId permiten trazabilidad y actualizaciones incrementales: cuando un documento cambia, re-chunkear y actualizar filas con mismo SourceId.
- RAGTopic (Managed Metadata) ayuda a routing semántico y boosting por tópico.

5) Consideraciones técnicas
----------------------------
- Evitar almacenar vectores en SharePoint; almacenar referencias (externalStoreName, externalId).
- Indexación incremental: usar RAGIndexedAt + Change Log (Microsoft Graph delta, webhook) para detectar cambios.
- Term store (Managed Metadata) para tópicos — mantenerlo en RAG Taxonomy term set, administrado por un pequeño equipo curador.

6) Ejemplo de flujo de ingestión
--------------------------------
1. Detectar nuevo/actualización (Microsoft Graph change notifications o planificado).
2. Si RAGClassification permite ingestion y RAGEmbeddingStatus != processed, extraer documento desde RAG-Source-Docs.
3. Chunk -> almacenar chunks en RAG-Processed-Chunks con RAGChunkId y RAGChunkOrder.
4. Enviar chunks al embedding service externo; guardar referencia en RAG-Embeddings-Index con externalId y RAGIndexedAt.
5. Marcar RAGEmbeddingStatus = processed y almacenar metadatos de resultado.

7) Buenas prácticas
-------------------
- Normalizar nombres de campos (prefijo RAG*) para evitar colisiones.
- Gestionar permisos con Azure AD groups y aplicar a sitios/bibliotecas, no a usuarios individuales.
- Documentar los term sets y mantener un small-team de curación.

Anexos
------
- File paths de artefactos en este repo:
  - infra/m365/create-sharepoint-site.ps1
  - infra/m365/taxonomy.md
  - infra/m365/migration-and-access.md

Puntos a revisar por el equipo: elección de classification values, políticas de retención (Purview), y flujo de embedding (dónde se almacenan vectores).