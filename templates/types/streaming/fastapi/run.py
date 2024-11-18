import os

import rich


def check_package_manager():
    """
    Check for available package managers and return the preferred one.
    Returns 'pnpm' if installed, falls back to 'npm'.
    """
    if os.system("pnpm --version > /dev/null 2>&1") == 0:
        return "pnpm"
    if os.system("npm --version > /dev/null 2>&1") == 0:
        return "npm"
    raise SystemError(
        "Neither pnpm nor npm is installed. Please install Node.js and a package manager first."
    )


def build():
    """
    Build the frontend and copy the static files to the backend.
    """
    package_manager = check_package_manager()
    rich.print(
        f"\n[bold]Installing frontend dependencies using {package_manager}. It might take a while...[/bold]"
    )
    os.system(f"cd .frontend && {package_manager} i")

    rich.print("\n[bold]Building the frontend[/bold]")
    os.system(f"cd .frontend && {package_manager} run build")

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
