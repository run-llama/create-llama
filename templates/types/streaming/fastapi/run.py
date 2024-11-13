import argparse
import os
from typing import Optional


def check_npm_installed():
    """
    Check if npm is installed on the system.
    """
    if os.system("npm --version > /dev/null 2>&1") != 0:
        raise SystemError("npm is not installed. Please install Node.js and npm first.")


def build():
    """
    Build the frontend and copy the static files to the backend.
    """
    check_npm_installed()
    print("\n===> Installing frontend dependencies. It might take a while...")
    os.system("cd .frontend && npm i")
    print("\n===> Building the frontend")
    os.system("cd .frontend && npm run build")
    os.system("mkdir -p static && rm -rf static/* && cp -r .frontend/out/* static")
    print(
        "\n===> Built frontend successfully!"
        "\n     Run: 'poetry run dev' to start the server"
        "\n     Don't forget to update the .env file!"
    )


def dev():
    """
    Start fastapi server.
    """
    print("===> Starting the development server")
    os.system("poetry run python main.py")


def main(command: Optional[str]):
    if command == "build":
        build()
    elif command == "dev":
        dev()
    else:
        raise ValueError(f"Invalid command: {command}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", type=str, nargs="?")
    args = parser.parse_args()
    main(args.command)
