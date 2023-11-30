import json
import os
from contextlib import contextmanager

import pytest
from continuedev.core.config import ContinueConfig, SerializedContinueConfig
from continuedev.libs.constants.default_config import default_config_json
from continuedev.libs.util.paths import getConfigFilePath


def test_continue_config_from_serialized_config():
    serialized_config = SerializedContinueConfig()
    config = ContinueConfig.from_serialized_config(serialized_config)
    assert isinstance(config, ContinueConfig)
    assert (
        config.allow_anonymous_telemetry == serialized_config.allow_anonymous_telemetry
    )


@contextmanager
def temp_clear_config():
    # make sure it is created, loaded in both cases
    json_path = getConfigFilePath(json=True)
    py_path = getConfigFilePath(json=False)

    # Move them somewhere temporary
    if os.path.exists(json_path + ".bak"):
        os.remove(json_path + ".bak")
    if os.path.exists(py_path + ".bak"):
        os.remove(py_path + ".bak")

    if os.path.exists(json_path):
        os.rename(json_path, json_path + ".bak")
    if os.path.exists(py_path):
        os.rename(py_path, py_path + ".bak")

    yield

    # Name them back
    if os.path.exists(json_path):
        os.remove(json_path)
    if os.path.exists(py_path):
        os.remove(py_path)
    if os.path.exists(json_path + ".bak"):
        os.rename(json_path + ".bak", json_path)
    if os.path.exists(py_path + ".bak"):
        os.rename(py_path + ".bak", py_path)


@pytest.mark.parametrize(
    "config_filename",
    [
        # "config_1.py",
        # "config_2.py",
    ],
)
def test_load_old_config(config_filename):
    with temp_clear_config():
        py_path = getConfigFilePath(json=False)

        test_filepath = os.path.join(
            os.path.dirname(__file__), "examples", config_filename
        )
        open(py_path, "w").write(open(test_filepath, "r").read())

        config = ContinueConfig.load_default()
        validate_continue_config(config)


def validate_continue_config(config: ContinueConfig):
    ctx_provs = config.get_context_provider_descriptions()
    assert isinstance(ctx_provs, list)

    slash_commands = config.get_slash_command_descriptions()
    assert isinstance(slash_commands, list)

    # Check config.json
    json_path = getConfigFilePath(json=True)
    assert os.path.exists(json_path)
    raw = json.load(open(json_path, "r"))
    assert "temperature" not in raw

    for model in raw["models"]:
        assert "timeout" not in model
        assert "top_k" not in model
        assert "top_p" not in model
        assert "template_messages" not in model

    assert len(raw["slash_commands"] + raw["custom_commands"]) == len(slash_commands)
    assert (
        len(raw.get("context_providers", [])) == len(ctx_provs) - 1
    )  # For file, which is automatically added
    assert (
        next((ctx for ctx in ctx_provs if ctx.title == "file"), None) is not None
    )  # File should be automatically added


def test_create_default_json_config():
    with temp_clear_config():
        json_path = getConfigFilePath(json=True)

        # Create and validate the default config
        config = ContinueConfig.load_default()
        validate_continue_config(config)

        # Ensure config.json was created
        assert open(json_path, "r").read() == default_config_json


def test_to_serialized_continue_config():
    pass
