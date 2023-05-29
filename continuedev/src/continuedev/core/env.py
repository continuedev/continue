from dotenv import load_dotenv
import os


def get_env_var(var_name: str):
    load_dotenv()
    return os.getenv(var_name)


def save_env_var(var_name: str, var_value: str):
    with open('.env', 'r') as f:
        lines = f.readlines()
    with open('.env', 'w') as f:
        values = {}
        for line in lines:
            key, value = line.split('=')
            value = value.replace('"', '')
            values[key] = value

        values[var_name] = var_value
        for key, value in values.items():
            f.write(f'{key}="{value}"\n')
