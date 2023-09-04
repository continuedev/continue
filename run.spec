# -*- mode: python ; coding: utf-8 -*-
import certifi
from PyInstaller.utils.hooks import copy_metadata

block_cipher = None


a = Analysis(
    ['run.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('continuedev', 'continuedev'),
        (certifi.where(), 'ca_bundle')
        ],
    hiddenimports=['anthropic', 'github', 'ripgrepy', 'bs4', 'redbaron', 'python-lsp-server', 'replicate'] + copy_metadata('replicate'),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['numpy', 'jedi'],
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
    name='run',
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
