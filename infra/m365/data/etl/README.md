ETL scripts - README

Propósito
- Contiene scripts de ejemplo que muestran cómo extraer datos desde Microsoft Graph (SharePoint lists/drives) y cargar a Azure Blob/ADLS en formato parquet.

Requisitos
- Python 3.9+
- Dependencias (pip): requests, msal, pandas, pyarrow, azure-storage-blob

Instalación de dependencias (ejemplo virtualenv)

python -m venv .venv
.\.venv\Scripts\activate
pip install requests msal pandas pyarrow azure-storage-blob

Uso (ejemplo)
- Configurar variables de entorno (no almacenar secretos en el repo):
  - M365_TENANT_ID
  - M365_CLIENT_ID
  - M365_CLIENT_SECRET
  - AZURE_STORAGE_CONNECTION_STRING (o STORAGE_ACCOUNT_URL + CREDENTIAL)

- Ejecutar script de ejemplo:
python sharepoint_graph_to_blob.py --site-id <site-id> --drive-id <drive-id> --output-path "documents/"

Notas
- Los scripts usan paginación y soportan escritura incremental usando lastModifiedDateTime. Adaptar a delta endpoints para mayor eficiencia.
- Para producción considerar usar Azure Data Factory, Azure Functions o Databricks con control de state y retries.
