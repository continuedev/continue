"""
Ejemplo básico de ETL: extrae metadatos de documentos y list items desde Microsoft Graph y guarda en Azure Blob (parquet)
No incluya secrets en el repo. Use variables de entorno.
"""
import os
import argparse
import json
import time
from typing import Dict, List, Any
import requests
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from io import BytesIO
from azure.storage.blob import BlobServiceClient
from msal import ConfidentialClientApplication

# Config (leer de entorno)
TENANT_ID = os.getenv("M365_TENANT_ID")
CLIENT_ID = os.getenv("M365_CLIENT_ID")
CLIENT_SECRET = os.getenv("M365_CLIENT_SECRET")
SCOPE = ["https://graph.microsoft.com/.default"]

STORAGE_CONN = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
STORAGE_CONTAINER = os.getenv("AZURE_STORAGE_CONTAINER", "m365")

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


def get_access_token() -> str:
    app = ConfidentialClientApplication(CLIENT_ID, authority=f"https://login.microsoftonline.com/{TENANT_ID}", client_credential=CLIENT_SECRET)
    result = app.acquire_token_for_client(scopes=SCOPE)
    if "access_token" not in result:
        raise Exception(f"Error acquiring token: {result}")
    return result["access_token"]


def graph_get(url: str, params: Dict[str, Any] = None, token: str = None) -> Dict:
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    r = requests.get(url, headers=headers, params=params)
    r.raise_for_status()
    return r.json()


def list_drive_items(drive_id: str, token: str, top: int = 200) -> List[Dict]:
    # Simplified listing (not recursive). For recursion, iterate children and use /delta for incremental.
    url = f"{GRAPH_BASE}/drives/{drive_id}/root/children"
    items = []
    params = {"$top": top}
    while url:
        resp = requests.get(url, headers={"Authorization": f"Bearer {token}"}, params=params)
        resp.raise_for_status()
        js = resp.json()
        items.extend(js.get("value", []))
        url = js.get("@odata.nextLink")
        params = None
    return items


def list_listitems(site_id: str, list_id: str, token: str, top: int = 200) -> List[Dict]:
    url = f"{GRAPH_BASE}/sites/{site_id}/lists/{list_id}/items?expand=fields"
    items = []
    while url:
        resp = requests.get(url, headers={"Authorization": f"Bearer {token}"})
        resp.raise_for_status()
        js = resp.json()
        items.extend(js.get("value", []))
        url = js.get("@odata.nextLink")
    return items


def to_parquet_and_upload(df: pd.DataFrame, dest_path: str, blob_service: BlobServiceClient, container: str):
    table = pa.Table.from_pandas(df)
    buf = BytesIO()
    pq.write_table(table, buf)
    buf.seek(0)
    blob_client = blob_service.get_blob_client(container=container, blob=dest_path)
    blob_client.upload_blob(buf, overwrite=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description="SharePoint/Graph -> Azure Blob ETL ejemplo")
    parser.add_argument("--site-id", help="Site id (o tenant default)", required=False)
    parser.add_argument("--drive-id", help="Drive id (document library)", required=False)
    parser.add_argument("--list-id", help="List id (para extraer list items)", required=False)
    parser.add_argument("--output-path", help="Ruta dentro del contenedor donde escribir (ej: documents/2026-08-09/docs.parquet)", required=True)
    args = parser.parse_args(argv)

    if not (TENANT_ID and CLIENT_ID and CLIENT_SECRET and STORAGE_CONN):
        raise Exception("Variables de entorno M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET y AZURE_STORAGE_CONNECTION_STRING deben estar definidas")

    token = get_access_token()
    blob_service = BlobServiceClient.from_connection_string(STORAGE_CONN)

    rows = []
    if args.drive_id:
        print(f"Listing drive items for drive {args.drive_id}...")
        items = list_drive_items(args.drive_id, token)
        for it in items:
            row = {
                "DocumentId": it.get("id"),
                "Name": it.get("name"),
                "FileSize": it.get("size"),
                "FileMimeType": (it.get("file") or {}).get("mimeType") if it.get("file") else None,
                "CreatedBy": (it.get("createdBy") or {}).get("user", {}).get("id"),
                "CreatedDateTime": it.get("createdDateTime"),
                "LastModifiedDateTime": it.get("lastModifiedDateTime"),
                "WebUrl": it.get("webUrl"),
                "ParentReference": json.dumps(it.get("parentReference"))
            }
            rows.append(row)

    if args.list_id and args.site_id:
        print(f"Listing list items for list {args.list_id} on site {args.site_id}...")
        items = list_listitems(args.site_id, args.list_id, token)
        for it in items:
            fields = it.get("fields", {})
            row = {"ItemId": it.get("id"), "ListId": args.list_id, "SiteId": args.site_id, "Fields": json.dumps(fields), "CreatedDateTime": fields.get("Created"), "LastModifiedDateTime": fields.get("Modified")}
            rows.append(row)

    if not rows:
        print("No rows to write. Exiting.")
        return

    df = pd.DataFrame(rows)
    # Optional: cast datetimes
    for c in ["CreatedDateTime", "LastModifiedDateTime"]:
        if c in df.columns:
            df[c] = pd.to_datetime(df[c], errors='coerce')

    # Write parquet and upload
    print(f"Uploading {len(df)} rows to {args.output_path}...")
    to_parquet_and_upload(df, args.output_path, blob_service, STORAGE_CONTAINER)
    print("Upload complete.")


if __name__ == '__main__':
    main()
