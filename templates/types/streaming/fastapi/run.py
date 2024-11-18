import os

import rich


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
    # Show in bold (using rich library)
    rich.print(
        "\n[bold]Installing frontend dependencies. It might take a while...[/bold]"
    )
    os.system("cd .frontend && npm i")
    rich.print("\n[bold]Building the frontend[/bold]")
    os.system("cd .frontend && npm run build")
    os.system("mkdir -p static && rm -rf static/* && cp -r .frontend/out/* static")
    rich.print(
        "\n[bold]Built frontend successfully![/bold]"
        "\n[bold]Run: 'poetry run dev' to start the app[/bold]"
        "\n[bold]Don't forget to update the .env file![/bold]"
    )


def dev():
    """
    Start fastapi app.
    """
    rich.print("\n[bold]Starting app[/bold]")
    os.system("poetry run python main.py")
