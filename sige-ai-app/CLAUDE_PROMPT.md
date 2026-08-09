Prompt para Claude — Levantar la primera app UI de SIGE (español)

Contexto
Eres un asistente técnico. Repositorio: SIGE (root). Objetivo: generar instrucciones paso a paso y mejoras para poner en marcha una app mínima llamada "sige-ai-app" que proporciona una caja de texto (frontend) y un backend Express que puede enviar prompts a un endpoint de IA (Claude u otro).

Tareas requeridas:
1) Revisa el scaffold existente en /sige-ai-app y valida que los scripts (server.js, public/*) sean seguros y tengan modo dry-run. Sugiere mejoras concretas.
2) Proporciona el comando exacto para instalar dependencias y ejecutar la app en Azure Cloud Shell (bash) y en Windows PowerShell.
3) Indica cómo conectar Claude (o un proxy) de forma segura: qué variables de entorno configurar y cómo usar Azure Key Vault o GitHub Secrets para no exponer claves.
4) Genera un ejemplo de payload y ejemplo de respuesta esperada cuando se usa Claude (simula una llamada y muestra la respuesta estructurada).
5) Añade checklist de pruebas: interfaz, envío de prompts largos, manejo de errores, latencia, y pruebas de seguridad (no exponer secrets, rate limiting).

Formato de salida (obligatorio):
- Resumen (3-4 frases)
- Pasos de ejecución (copy-paste)
- Snippets de configuración (env vars, ejemplo Key Vault commands)
- JSON de ejemplo request/response
- Lista de mejoras priorizadas (3 items)

Restricciones:
- No intentes ejecutar nada en el tenant ni almacenar claves en el repo.
- Mantén las instrucciones precisas y aptas para que un ingeniero junior las copie/pegue.

Fin.
