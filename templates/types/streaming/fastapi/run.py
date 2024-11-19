import shutil
from pathlib import Path
from shutil import which
from subprocess import DEVNULL, CalledProcessError, run

import rich


def check_package_manager() -> str:
    """
    Check for available package managers and return the preferred one.
    Returns 'pnpm' if installed, falls back to 'npm'.
    Raises SystemError if neither is installed.

    Returns:
        str: The name of the available package manager ('pnpm' or 'npm')
    """
    if which("pnpm") is not None:
        return "pnpm"
    if which("npm") is not None:
        return "npm"
    raise SystemError(
        "Neither pnpm nor npm is installed. Please install Node.js and a package manager first."
    )


def build():
    """
    Build the frontend and copy the static files to the backend.

    Raises:
        SystemError: If any build step fails
    """
    frontend_dir = Path(".frontend")
    static_dir = Path("static")

    try:
        package_manager = check_package_manager()
        rich.print(
            f"\n[bold]Installing frontend dependencies using {package_manager}. It might take a while...[/bold]"
        )
        run([package_manager, "install"], cwd=frontend_dir, check=True, stderr=DEVNULL)

        rich.print("\n[bold]Building the frontend[/bold]")
        run([package_manager, "run", "build"], cwd=frontend_dir, check=True)

        if static_dir.exists():
            shutil.rmtree(static_dir)
        static_dir.mkdir(exist_ok=True)

        shutil.copytree(frontend_dir / "out", static_dir, dirs_exist_ok=True)

        rich.print(
            "\n[bold]Built frontend successfully![/bold]"
            "\n[bold]Run: 'poetry run dev' to start the app[/bold]"
            "\n[bold]Don't forget to update the .env file![/bold]"
        )
    except CalledProcessError as e:
        raise SystemError(f"Build failed during {e.cmd}") from e
    except Exception as e:
        raise SystemError(f"Build failed: {str(e)}") from e


def dev():
    """
    Start fastapi app using poetry's virtual environment.

    Raises:
        SystemError: If the app fails to start
    """
    rich.print("\n[bold]Starting app[/bold]")
    try:
        run(["poetry", "run", "python", "main.py"], check=True)
    except KeyboardInterrupt:
        rich.print("\n[bold yellow]Shutting down...[/bold yellow]")
        return
    except Exception as e:
        raise SystemError(f"Failed to start app: {str(e)}") from e
