# -*- mode: python ; coding: utf-8 -*-
import certifi
import os
from PyInstaller.utils.hooks import copy_metadata

block_cipher = None

chroma_toc = list(map(lambda x: (x[1], os.path.dirname(x[0])), Tree('./env/lib/python3.11/site-packages/chromadb/migrations', prefix="chromadb/migrations")))

a = Analysis(
    ['continue_server.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('continuedev', 'continuedev'),
        (certifi.where(), 'ca_bundle'),
        ] + copy_metadata('replicate') + chroma_toc,
    hiddenimports=[
        'anthropic', 'github', 'ripgrepy', 'bs4', 'redbaron',
        'chromadb', 'onnxruntime',
        'chromadb.telemetry.posthog',
        'chromadb.api.segment', 'chromadb.db.impl',
        'chromadb.db.impl.sqlite', 'chromadb.migrations',
        'chromadb.migrations.embeddings_queue', 'chromadb.migrations.sysdb',
        'chromadb.migrations.metadb', 'chromadb.segment.impl',
        'chromadb.segment.impl.manager', 'chromadb.segment.impl.manager.local',
        'chromadb.segment.impl.metadata', 'chromadb.segment.impl.metadata.sqlite'
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
