# Infra: M365 App Registrations (SIGE)

Resumen
- Objetivo: generar manifiestos y scripts para crear App Registrations (dev/staging/prod) + Service Principals, crear client secrets y almacenar secrets en Azure Key Vault.
- Alcance: artefactos solo (plantillas y scripts). No se provisiona nada automáticamente sin confirmación humana.

Estructura de artefactos (ruta relativa al repo)
- infra/m365/manifests/app-manifest.json  — plantilla de manifiesto de App Registration
- infra/m365/scripts/create-app.ps1       — PowerShell + az CLI para crear la App, SP y secret (dry-run flag)
- infra/m365/scripts/store-secret-in-kv.ps1 — PowerShell para guardar secret en Key Vault y asignar accesos
- infra/m365/scripts/grant-admin-consent.ps1 — ejemplos para conceder admin consent por tenant

Matriz de permisos recomendada (por entorno)

Dev (desarrollo)
- Uso principal: pruebas de integración y desarrollo. Usuarios: desarrolladores, entornos CI no prod.
- Permisos recomendados:
  - Delegated: User.Read, Mail.Send (si la app actúa en nombre del usuario). Mantener al mínimo.
  - Application: NONE by default. Evitar permisos de application en dev salvo que sea estrictamente necesario.
- Justificación: en dev preferimos minimizar blast radius; el desarrollo puede usar permisos delegados otorgados por usuarios.

Staging (pre-producción)
- Uso principal: pruebas E2E con datos próximos a producción.
- Permisos recomendados:
  - Delegated: User.Read, Mail.Send (si procede).
  - Application: Group.Read.All (lectura de grupos) *solo si* se requiere acceso de backend sin usuario.
- Justificación: staging puede necesitar permisos más amplios para simular producción, pero preferir permisos de lectura y auditar consent.

Production (prod)
- Uso principal: app productiva (servicios back-end, integración con Graph/SharePoint/Teams).
- Permisos recomendados:
  - Delegated: mínimo necesario para funcionalidades que actúen en nombre de usuarios.
  - Application: Application permissions para escenarios server-to-server (por ejemplo, Mail.Send application para envío masivo, Sites.Read.All para lectura de SharePoint). Ejemplos específicos:
    - Sites.Read.All (application) — acceso a SharePoint para procesos back-end
    - Mail.Send (application) — envío de correos desde servicio
    - Group.Read.All (application) — inventario de grupos
- Justificación: production suele requerir permisos de aplicación porque no hay un usuario interactivo; aplicar el principio de mínimo privilegio y separar identidades por entorno (apps distintas por entorno o uso de conditional access).

Recomendaciones generales
- Crear App Registrations separadas por entorno (dev/staging/prod) para poder auditar y rotar secretos por entorno.
- Siempre almacenar los client secrets en Azure Key Vault y habilitar rotación automática cuando sea posible.
- Preferir Managed Identities cuando el recurso que usa la app vive en Azure y puede usar una managed identity en vez de client secrets.
- Documentar admin-consent requerido y proporcionar scripts y URL de consentimiento para responsables IT.

Notas de seguridad
- No incluir secrets en repositorio. Los scripts guardan secrets directamente en Key Vault; por defecto solo imprimen el secret en consola si --dry-run no está activado.
- Requerir confirmación humana (parámetro -Confirm:$true o -WhatIf) antes de ejecutar cambios irreversible.

Siguientes pasos (checklist para PR)
- [ ] Añadir y revisar los manifiestos en infra/m365/manifests/
- [ ] Validar scripts en entorno de laboratorio (no prod)
- [ ] Revisar y aprobar matriz de permisos con equipo de seguridad
- [ ] Crear PR con los archivos y solicitar revisión de infra-seguridad
