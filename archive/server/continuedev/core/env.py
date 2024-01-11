import os

from dotenv import load_dotenv


def get_env_var(var_name: str):
    load_dotenv()
    return os.getenv(var_name)


def make_sure_env_exists():
    if not os.path.exists(".env"):
        with open(".env", "w") as f:
            f.write("")


def save_env_var(var_name: str, var_value: str):
    make_sure_env_exists()

    with open(".env", "r") as f:
        lines = f.readlines()
    with open(".env", "w") as f:
        values = {}
        for line in lines:
            key, value = line.split("=")
            value = value.replace('"', "")
            values[key] = value

        values[var_name] = var_value
        for key, value in values.items():
            f.write(f'{key}="{value}"\n')
