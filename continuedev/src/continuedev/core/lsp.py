import os
import socket
import subprocess
import threading
from typing import List, Optional

from pydantic import BaseModel
from pylsp.python_lsp import PythonLSPServer, start_tcp_lang_server

from ..libs.lspclient.json_rpc_endpoint import JsonRpcEndpoint
from ..libs.lspclient.lsp_client import LspClient
from ..libs.lspclient.lsp_endpoint import LspEndpoint
from ..libs.lspclient.lsp_structs import Position as LspPosition
from ..libs.lspclient.lsp_structs import SymbolInformation, TextDocumentIdentifier
from ..libs.util.logging import logger
from ..models.filesystem import RangeInFile
from ..models.main import Position, Range


class ReadPipe(threading.Thread):
    def __init__(self, pipe):
        threading.Thread.__init__(self)
        self.pipe = pipe

    def run(self):
        line = self.pipe.readline().decode("utf-8")
        while line:
            print(line)
            line = self.pipe.readline().decode("utf-8")


class SocketFileWrapper:
    def __init__(self, sockfile):
        self.sockfile = sockfile

    def write(self, data):
        if isinstance(data, bytes):
            data = data.decode("utf-8").replace("\r\n", "\n")
        return self.sockfile.write(data)

    def read(self, size=-1):
        data = self.sockfile.read(size)
        if isinstance(data, str):
            data = data.replace("\n", "\r\n").encode("utf-8")
        return data

    def readline(self, size=-1):
        data = self.sockfile.readline(size)
        if isinstance(data, str):
            data = data.replace("\n", "\r\n").encode("utf-8")
        return data

    def flush(self):
        return self.sockfile.flush()

    def close(self):
        return self.sockfile.close()


def create_json_rpc_endpoint(use_subprocess: Optional[str] = None):
    if use_subprocess is None:
        try:
            threading.Thread(
                target=start_tcp_lang_server,
                args=("localhost", 8080, False, PythonLSPServer),
            ).start()
        except Exception as e:
            logger.warning("Could not start TCP server: %s", e)

        # Connect to the server
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(("localhost", 8080))

        # Create a file-like object from the socket
        sockfile = s.makefile("rw")
        wrapped_sockfile = SocketFileWrapper(sockfile)
        return JsonRpcEndpoint(wrapped_sockfile, wrapped_sockfile), None

    else:
        pyls_cmd = use_subprocess.split()
        p = subprocess.Popen(
            pyls_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        read_pipe = ReadPipe(p.stderr)
        read_pipe.start()
        return JsonRpcEndpoint(p.stdin, p.stdout), p


def filename_to_uri(filename: str) -> str:
    return f"file://{filename}"


def uri_to_filename(uri: str) -> str:
    if uri.startswith("file://"):
        return uri.lstrip("file://")
    else:
        return uri


def create_lsp_client(workspace_dir: str, use_subprocess: Optional[str] = None):
    json_rpc_endpoint, process = create_json_rpc_endpoint(use_subprocess=use_subprocess)
    lsp_endpoint = LspEndpoint(json_rpc_endpoint)
    lsp_client = LspClient(lsp_endpoint)
    capabilities = {
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
    }
    root_uri = filename_to_uri(workspace_dir)
    dir_name = os.path.basename(workspace_dir)
    workspace_folders = [{"name": dir_name, "uri": root_uri}]
    lsp_client.initialize(
        None,
        None,
        root_uri,
        None,
        capabilities,
        "off",
        workspace_folders,
    )
    lsp_client.initialized()
    return lsp_client, process


class ContinueLSPClient(BaseModel):
    workspace_dir: str
    lsp_client: LspClient = None
    use_subprocess: Optional[str] = None
    lsp_process: Optional[subprocess.Popen] = None

    class Config:
        arbitrary_types_allowed = True

    def dict(self, **kwargs):
        original_dict = super().dict(**kwargs)
        original_dict.pop("lsp_client", None)
        return original_dict

    async def start(self):
        self.lsp_client, self.lsp_process = create_lsp_client(
            self.workspace_dir, use_subprocess=self.use_subprocess
        )

    async def stop(self):
        self.lsp_client.shutdown()
        self.lsp_client.exit()
        if self.lsp_process is not None:
            self.lsp_process.terminate()
            self.lsp_process.wait()
            self.lsp_process = None

    def goto_definition(self, position: Position, filename: str) -> List[RangeInFile]:
        response = self.lsp_client.definition(
            TextDocumentIdentifier(filename_to_uri(filename)),
            LspPosition(position.line, position.character),
        )
        return [
            RangeInFile(
                filepath=uri_to_filename(x.uri),
                range=Range.from_shorthand(
                    x.range.start.line,
                    x.range.start.character,
                    x.range.end.line,
                    x.range.end.character,
                ),
            )
            for x in response
        ]

    def get_symbols(self, filepath: str) -> List[SymbolInformation]:
        response = self.lsp_client.documentSymbol(
            TextDocumentIdentifier(filename_to_uri(filepath))
        )

        return response
