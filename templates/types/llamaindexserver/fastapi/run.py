import os
import subprocess


def run(env: str):
    os.environ["APP_ENV"] = env
    app_host = os.getenv("APP_HOST", "0.0.0.0")
    app_port = os.getenv("APP_PORT", "8000")

    if env == "dev":
        subprocess.run(["fastapi", "dev", "--host", app_host, "--port", app_port])
    else:
        subprocess.run(["fastapi", "run", "--host", app_host, "--port", app_port])


def run_dev():
    run("dev")


def run_prod():
    run("prod")
