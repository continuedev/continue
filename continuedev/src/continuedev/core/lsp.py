import asyncio
import threading
from typing import List, Optional

import aiohttp
from pydantic import BaseModel
from pylsp.python_lsp import PythonLSPServer, start_ws_lang_server

from ..libs.util.logging import logger
from ..models.filesystem import RangeInFile
from ..models.main import Position, Range


def filepath_to_uri(filename: str) -> str:
    return f"file://{filename}"


def uri_to_filepath(uri: str) -> str:
    if uri.startswith("file://"):
        return uri.lstrip("file://")
    else:
        return uri


PORT = 8099


class LSPClient:
    def __init__(self, host: str, port: int, workspace_paths: List[str]):
        self.host = host
        self.port = port
        self.session = aiohttp.ClientSession()
        self.next_id = 0
        self.workspace_paths = workspace_paths

    async def connect(self):
        print("Connecting")
        self.ws = await self.session.ws_connect(f"ws://{self.host}:{self.port}/")
        print("Connected")

    async def send(self, data):
        await self.ws.send_json(data)

    async def recv(self):
        return await self.ws.receive_json()

    async def close(self):
        await self.ws.close()
        await self.session.close()

    async def call_method(self, method_name, **kwargs):
        body = {
            "jsonrpc": "2.0",
            "id": self.next_id,
            "method": method_name,
            "params": kwargs,
        }
        self.next_id += 1
        await self.send(body)
        response = await self.recv()
        return response

    async def initialize(self):
        initialization_args = {
            "capabilities": {
                "textDocument": {
                    "codeAction": {"dynamicRegistration": True},
                    "codeLens": {"dynamicRegistration": True},
                    "colorProvider": {"dynamicRegistration": True},
                    "completion": {
                        "completionItem": {
                            "commitCharactersSupport": True,
                            "documentationFormat": ["markdown", "plaintext"],
                            "snippetSupport": True,
                        },
                        "completionItemKind": {
                            "valueSet": [
                                1,
                                2,
                                3,
                                4,
                                5,
                                6,
                                7,
                                8,
                                9,
                                10,
                                11,
                                12,
                                13,
                                14,
                                15,
                                16,
                                17,
                                18,
                                19,
                                20,
                                21,
                                22,
                                23,
                                24,
                                25,
                            ]
                        },
                        "contextSupport": True,
                        "dynamicRegistration": True,
                    },
                    "definition": {"dynamicRegistration": True},
                    "documentHighlight": {"dynamicRegistration": True},
                    "documentLink": {"dynamicRegistration": True},
                    "documentSymbol": {
                        "dynamicRegistration": True,
                        "symbolKind": {
                            "valueSet": [
                                1,
                                2,
                                3,
                                4,
                                5,
                                6,
                                7,
                                8,
                                9,
                                10,
                                11,
                                12,
                                13,
                                14,
                                15,
                                16,
                                17,
                                18,
                                19,
                                20,
                                21,
                                22,
                                23,
                                24,
                                25,
                                26,
                            ]
                        },
                    },
                    "formatting": {"dynamicRegistration": True},
                    "hover": {
                        "contentFormat": ["markdown", "plaintext"],
                        "dynamicRegistration": True,
                    },
                    "implementation": {"dynamicRegistration": True},
                    "onTypeFormatting": {"dynamicRegistration": True},
                    "publishDiagnostics": {"relatedInformation": True},
                    "rangeFormatting": {"dynamicRegistration": True},
                    "references": {"dynamicRegistration": True},
                    "rename": {"dynamicRegistration": True},
                    "signatureHelp": {
                        "dynamicRegistration": True,
                        "signatureInformation": {
                            "documentationFormat": ["markdown", "plaintext"]
                        },
                    },
                    "synchronization": {
                        "didSave": True,
                        "dynamicRegistration": True,
                        "willSave": True,
                        "willSaveWaitUntil": True,
                    },
                    "typeDefinition": {"dynamicRegistration": True},
                },
                "workspace": {
                    "applyEdit": True,
                    "configuration": True,
                    "didChangeConfiguration": {"dynamicRegistration": True},
                    "didChangeWatchedFiles": {"dynamicRegistration": True},
                    "executeCommand": {"dynamicRegistration": True},
                    "symbol": {
                        "dynamicRegistration": True,
                        "symbolKind": {
                            "valueSet": [
                                1,
                                2,
                                3,
                                4,
                                5,
                                6,
                                7,
                                8,
                                9,
                                10,
                                11,
                                12,
                                13,
                                14,
                                15,
                                16,
                                17,
                                18,
                                19,
                                20,
                                21,
                                22,
                                23,
                                24,
                                25,
                                26,
                            ]
                        },
                    },
                    "workspaceEdit": {"documentChanges": True},
                    "workspaceFolders": True,
                },
            },
            "processId": 1234,
            "rootPath": None,
            "rootUri": filepath_to_uri(self.workspace_paths[0]),
            "initializationOptions": {},
            "trace": "off",
            "workspaceFolders": [
                {
                    "uri": filepath_to_uri(workspacePath),
                    "name": workspacePath.split("/")[-1],
                }
                for workspacePath in self.workspace_paths
            ],
        }
        return await self.call_method("initialize", **initialization_args)

    async def goto_definition(self, filepath: str, position: Position):
        return await self.call_method(
            "textDocument/definition",
            textDocument={"uri": filepath_to_uri(filepath)},
            position=position.dict(),
        )

    async def document_symbol(self, filepath: str):
        return await self.call_method(
            "textDocument/documentSymbol",
            textDocument={"uri": filepath_to_uri(filepath)},
        )


async def start_language_server() -> threading.Thread:
    try:
        thread = threading.Thread(
            target=start_ws_lang_server,
            args=(PORT, False, PythonLSPServer),
        )
        thread.daemon = True
        thread.start()

    except Exception as e:
        logger.warning("Could not start TCP server: %s", e)

    await asyncio.sleep(2)

    return thread


class DocumentSymbol(BaseModel):
    name: str
    containerName: Optional[str] = None
    kind: int
    location: RangeInFile


class ContinueLSPClient(BaseModel):
    workspace_dir: str

    lsp_client: LSPClient = None
    lsp_thread: Optional[threading.Thread] = None

    class Config:
        arbitrary_types_allowed = True

    def dict(self, **kwargs):
        original_dict = super().dict(**kwargs)
        original_dict.pop("lsp_client", None)
        return original_dict

    async def start(self):
        self.lsp_thread = await start_language_server()
        self.lsp_client = LSPClient("localhost", PORT, [self.workspace_dir])
        await self.lsp_client.connect()
        await self.lsp_client.initialize()

    async def stop(self):
        await self.lsp_client.close()
        if self.lsp_thread:
            self.lsp_thread.join()

    async def goto_definition(
        self, position: Position, filename: str
    ) -> List[RangeInFile]:
        response = self.lsp_client.goto_definition(
            filename,
            position,
        )
        return [
            RangeInFile(
                filepath=uri_to_filepath(x.uri),
                range=Range.from_shorthand(
                    x.range.start.line,
                    x.range.start.character,
                    x.range.end.line,
                    x.range.end.character,
                ),
            )
            for x in response
        ]

    async def document_symbol(self, filepath: str) -> List:
        response = await self.lsp_client.document_symbol(filepath)
        return [
            DocumentSymbol(
                name=x["name"],
                containerName=x["containerName"],
                kind=x["kind"],
                location=RangeInFile(
                    filepath=uri_to_filepath(x["location"]["uri"]),
                    range=Range.from_shorthand(
                        x["location"]["range"]["start"]["line"],
                        x["location"]["range"]["start"]["character"],
                        x["location"]["range"]["end"]["line"],
                        x["location"]["range"]["end"]["character"],
                    ),
                ),
            )
            for x in response["result"]
        ]
