from cx_Freeze import setup, Executable

setup(
    name="Continue",
    version="0.1",
    description="Continue Server",
    executables=[Executable("run.py")],

    options={
        "build_exe": {
            "excludes": ["unnecessary_module"],
        },
    },
)
