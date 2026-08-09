# Plantillas de reglas DLP (Microsoft Purview / M365)

Este documento contiene plantillas y ejemplos de reglas DLP que se pueden importar o usar como referencia al configurar políticas en Microsoft Purview Compliance Center.

Cada regla incluye: nombre, descripción, ámbito (SharePoint/OneDrive/Exchange/Microsoft Teams), condiciones (tipos de información sensible o expresiones regulares), acciones (notificar, encriptar, bloquear, aplicar etiqueta), propietarios y manejo de excepciones.

---

## 1) Regla: Bloqueo de tarjetas de crédito (PCI)
- Nombre: DLP_Block_PCI_CreditCards
- Descripción: Detecta y bloquea el envío/compartición de números de tarjeta de crédito.
- Ámbito: Exchange Online (correo saliente), SharePoint/OneDrive, Teams (archivos y chat/adjuntos)
- Condición: Coincidencia >=1 instancia de "Credit Card Number" (Built-in sensitive info type) OR regex: (?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})
- Umbral: 1 ocurrencia
- Acciones:
  - Bloquear la transferencia externa (block and quarantine)
  - Aplicar etiqueta: Restringido/PCI
  - Generar alerta de incidente y enviar notificación al equipo de seguridad
  - Registrar evento en log central (SIEM)
- Excepciones: Usuarios en el grupo "Finance PCI Exceptions" con justificación.

---

## 2) Regla: Protección de información de salud (PHI)
- Nombre: DLP_FN_PHl_PHICase
- Descripción: Detecta PHI combinado con identificadores personales y evita su divulgación.
- Ámbito: SharePoint/OneDrive, Teams
- Condición: Coincidencia de términos médicos (PHI built-in) + coincidencia de identificadores (DNI, SSN, email)
- Acciones:
  - Aplicar etiqueta: Restringido/PHI
  - Bloquear compartición externa
  - Crear caso en eDiscovery si excede X documentos
  - Enviar notificación confidencial al propietario del dato

---

## 3) Regla: Detección de secretos y credenciales en repositorios / archivos
- Nombre: DLP_Detect_Secrets
- Descripción: Detecta patrones de secretos (claves privadas, connection strings, tokens) en archivos y scripts.
- Ámbito: SharePoint/OneDrive, Teams, repositorios Git (si se integra con Purview/M365 scan agents)
- Condición: Regexes y heurísticos, ejemplo:
  - BEGIN (RSA|PRIVATE) KEY
  - (?:[A-Za-z0-9_-]{20,})\.(?:[A-Za-z0-9_-]{20,})\.(?:[A-Za-z0-9_-]{20,})  (JWT-like)
  - (?:Password|Pwd|Secret)\s*[:=]\s*\S{8,}
  - Connection strings: "Server=.+;Database=.+;User Id=.+;Password=.+;"
- Acciones:
  - Aplicar etiqueta: Restringido (o Altamente confidencial)
  - Bloquear compartición externa
  - Crear ticket automático a Infraestructura y asignar propietario
  - Opcional: ejecutar playbook de rotación de secretos si integrada con sistema de secreto
- Excepciones: Ninguna por defecto

---

## 4) Regla: Información de identificación personal (PII) — multiple occurrences
- Nombre: DLP_PII_Multiple
- Descripción: Detecta documentos que contienen múltiples piezas de PII (p.ej. nombre+email+documento)
- Ámbito: SharePoint/OneDrive, Exchange
- Condición: Combinación de >=2 tipos de PII (email + DNI, o nombre + fecha de nacimiento)
- Acciones:
  - Aplicar etiqueta: Altamente confidencial (PII)
  - Notificar al usuario y requerir revisión antes de compartir externamente
  - Registrar evento para auditoría

---

## Recomendaciones de configuración
1. Fase piloto: crear cada regla en modo "Audit only" durante 2-4 semanas para calibrar falsos positivos.
2. Alertas y gestión: integrar con Microsoft Sentinel o SIEM para ingestión de incidentes. Configurar playbooks automatizados en Microsoft Defender/Logic Apps para respuesta.
3. Documentar exenciones y aprobarlas mediante proceso formal.
4. Mantener un catálogo de tipos sensibles (lista blanca/negra) actualizado.

---

## Exportable JSON ejemplo (esqueleto)

Nota: El siguiente JSON es un esquema orientativo para representar la regla; la importación a Purview se hace vía UI o APIs que requieren un formato específico (use Graph/Compliance APIs para integraciones automatizadas).

{
  "displayName": "DLP_Block_PCI_CreditCards",
  "description": "Detecta y bloquea tarjetas de crédito",
  "scopes": ["Exchange","SharePoint","OneDrive","Teams"],
  "conditions": {
    "sensitiveInfoTypes": ["Credit Card Number"],
    "regex": ["(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})"]
  },
  "actions": {
    "block": true,
    "quarantine": true,
    "applyLabel": "Restringido/PCI",
    "notify": ["security@contoso.com"]
  },
  "exceptions": {
    "allowedGroups": ["Finance PCI Exceptions"]
  }
}

---

Mantener este archivo como referencia al crear políticas en Microsoft Purview. Para automatizar su creación, use los scripts/instrucciones en infra/m365/purview/labeling-automation.ps1 y las APIs de Microsoft Graph/Compliance.