# Integración Microsoft 365 para SIGE — Entregable

Fecha: 2026-08-09
Autor: Equipo SIGE (generado automáticamente)

---

## 1. Resumen ejecutivo
Microsoft 365 será la capa de adquisición, gobierno, colaboración y analítica para SIGE. La integración distingue entre: (A) conocimiento indexado y citable (SharePoint + Connectors/Copilot) y (B) acciones transaccionales (Microsoft Graph / Power Platform). Se respetan ACLs y la identidad del usuario; las escrituras requieren permisos separados y aprobación.

## 2. Estructura y subagentes
Siete subagentes: tenant, identidad, SharePoint, Graph, datos/PowerBI, Purview, Teams. Cada uno tiene entregables definidos en config/m365-build-agents.json.

## 3. Plan de integración (fases y checklist resumido)
Fase 0 — Inventario y decisiones (owner: platform-sre)
- [ ] Exportar inventario tenant: dominios, licencias, usuarios, grupos, roles
- [ ] Mapear owners y fuentes autoritativas
- [ ] Documentar requisitos de residencia y retención

Fase 1 — Identidad y accesos (owner: cybersecurity)
- [ ] Crear App Registrations por ambiente
- [ ] Definir matriz permisos (delegado vs aplicación)
- [ ] Configurar MFA y Conditional Access
- [ ] Provisión de Managed Identities / certificados

Fase 2 — Arquitectura SharePoint (owner: data-knowledge-rag)
- [ ] Diseñar sitios y bibliotecas por propósito
- [ ] Definir metadatos, owners y retenciones
- [ ] Crear zona aprobada para fuentes RAG

Fase 3 — Graph & Ingest (owner: api-integrations)
- [ ] Implementar delta queries y change notifications
- [ ] Exponer endpoints webhook seguros (TLS, clientState)
- [ ] Manejar throttling, replay y deduplicación

Fase 4 — Analítica (owner: data-knowledge-rag)
- [ ] Definir modelo semántico y datasets
- [ ] Crear dashboard inicial Power BI (adopción/agentes)
- [ ] Documentar linaje y políticas de refresh

Fase 5 — Purview & Compliance (owner: ai-governance)
- [ ] Aplicar etiquetas de sensibilidad y DLP
- [ ] Configurar retención y eDiscovery
- [ ] Programar revisiones trimestrales

Governance / Gate (pre-prod)
- [ ] Owner de datos sign-off
- [ ] Prueba de usuario sin permisos
- [ ] Mecanismo de revocación y plan de rollback

## 4. Inventario técnico y puntos de integración (destacado)
- SIGE-PROJECT-Cloud/docs/04_MICROSOFT_365.md — política y arquitectura.
- SIGE-PROJECT-Cloud/config/m365-build-agents.json — definición de subagentes.
- SIGE-PROJECT-Cloud/src/sige/*.py — adaptadores, ingest, router y orquestación.
- SIGE-PROJECT-Cloud/config/knowledge-sources.json — fuentes mapeables a conectores.
- Scripts: SIGE-PROJECT-Cloud/scripts/verify.* — pruebas de integración.
- Azure/LLM providers en sige-packages (ej. llm-info/providers/azure.ts).

## 5. Credenciales y permisos mínimos recomendados
- Tenant admin: inventario inicial y aprobaciones.
- App Registration por ambiente: permisos mínimos (Sites.Read.All, Group.Read.All) delegados para indexado; permisos de aplicación solo si escritura automatizada (justificada).
- Secrets en Azure Key Vault o managed identities; endpoints HTTPS públicos verificados para webhooks.
- Roles Power BI/ Purview según entregables.

## 6. Riesgos y controles rápidos
- Evitar exposición de datos sensibles en RAG: redacción, ACL-respect.  
- Throttling/duplicados: usar queues y replay-safe processing.  
- Permisos excesivos: aplicar principio de mínimo privilegio y revisiones trimestrales.

## 7. Próximos pasos inmediatos
1. Ejecutar Fase 0: generar inventario completo (issue creado).  
2. Provisionar App Registration de prueba y endpoint webhook para change notifications.  
3. Planificar workshop para owners (2–4 horas).

---

Documento generado automáticamente. Para tareas y seguimiento, ver los issues creados en SIGE-PROJECT-Cloud.
