# -*- mode: python ; coding: utf-8 -*-
import certifi
import os
import sys
from PyInstaller.utils.hooks import copy_metadata
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--arch", type=str)
parser.add_argument("--dir", type=bool, default=False)
options = parser.parse_args()

block_cipher = None

import subprocess
def find_package_location(package_name):
    try:
        # Run the 'pip show' command and capture its output
        result = subprocess.run(['pip', 'show', package_name], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        output = result.stdout

        # Split the output into lines and find the 'Location' field
        for line in output.splitlines():
            if line.startswith('Location:'):
                # Extract the path after the 'Location:' prefix
                location = line.split(':', 1)[1].strip()
                return location

    except subprocess.CalledProcessError as e:
        print(f"Error: {e.stderr}")

    return None

chroma_path = find_package_location('chromadb')
chroma_toc = list(map(lambda x: (x[1], os.path.dirname(x[0])), Tree(f'{chroma_path}/chromadb/migrations', prefix="chromadb/migrations")))

tsl_path = find_package_location('tree_sitter_languages')
tsl_filename = "languages.dll" if sys.platform == "win32" else "languages.so"

a = Analysis(
    ['continue_server.py'],
    pathex=[],
    binaries=[(os.path.join(tsl_path, 'tree_sitter_languages', tsl_filename), "tree_sitter_languages")],
    datas=[
        ('server/continuedev', 'continuedev'),
        (certifi.where(), 'ca_bundle'),
        ('.tiktoken_cache', 'tiktoken_cache'),
        ] + copy_metadata('replicate') + chroma_toc,
    hiddenimports=[
        'anthropic', 'github', 'ripgrepy', 'bs4', 'redbaron', 'tree_sitter', 'tree_sitter_languages',
        'chromadb', 'onnxruntime',
        'chromadb.telemetry.posthog',
        'chromadb.api.segment', 'chromadb.db.impl',
        'chromadb.db.impl.sqlite', 'chromadb.migrations',
        'chromadb.migrations.embeddings_queue', 'chromadb.migrations.sysdb',
        'chromadb.migrations.metadb', 'chromadb.segment.impl',
        'chromadb.segment.impl.manager', 'chromadb.segment.impl.manager.local',
        'chromadb.segment.impl.metadata', 'chromadb.segment.impl.metadata.sqlite',
        # 'pysqlite3'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)


target_arch = "arm64" if options.arch == "m1" else None
print("Using target arch", target_arch)

if options.dir:
    print("Using directory")
    exe = EXE(
        pyz,
        a.scripts,
        exclude_binaries=True,
        name='continue_server',
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,
        upx_exclude=[],
        runtime_tmpdir=None,
        console=True,
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=target_arch,
        codesign_identity=None,
        entitlements_file=None,
    )

    coll = COLLECT(
        exe,
        a.binaries,
        a.datas,
        name='continue_server',
    )

else:
    print("Using one file")
    exe = EXE(
        pyz,
        a.scripts,
        a.binaries,
        a.zipfiles,
        a.datas,
        [],
        name='continue_server',
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,
        upx_exclude=[],
        runtime_tmpdir=None,
        console=True,
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
    )