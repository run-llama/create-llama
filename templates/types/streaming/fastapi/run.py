import os


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
