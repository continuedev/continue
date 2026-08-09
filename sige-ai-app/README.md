SIGE AI App — Caja de texto para pruebas con IA (multi-proveedor)

Resumen
Una app mínima para enviar prompts desde una caja de texto a varios proveedores de IA (Claude, OpenAI, proxys). Los proveedores se configuran en providers.json o mediante la UI de configuración (/config.html). Los secretos (API keys) NO se guardan en el repo: se deben usar variables de entorno o Azure Key Vault.

Configuración rápida
1. Instala dependencias:
   npm install
2. Configura un proveedor y su API key (ejemplo en Linux/Mac):
   export AI_API_KEY_CLAUDE="<tu-key>"
   export AI_DEFAULT_PROVIDER=claude
3. Ejecuta la app:
   npm start
4. Abre http://localhost:3000
5. Para editar proveedores (metadatos): abrir http://localhost:3000/config.html

Notas de seguridad
- No pongan keys en providers.json. Use Key Vault o variables de entorno.
- Naming convention for env keys is AI_API_KEY_{PROVIDER_ID} by default, or use secretEnv field in providers.json.

Ejemplo providers.json
[
  { "id": "claude", "name":"Anthropic Claude", "endpoint":"https://api.anthropic.com/v1/claude", "secretEnv":"AI_API_KEY_CLAUDE" }
]

