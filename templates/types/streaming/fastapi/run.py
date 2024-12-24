import asyncio
import os
import shutil
import socket
from asyncio.subprocess import Process
from pathlib import Path
from shutil import which
from subprocess import CalledProcessError, run

import dotenv
import rich

dotenv.load_dotenv()


FRONTEND_DIR = Path(os.getenv("FRONTEND_DIR", ".frontend"))
APP_HOST = os.getenv("APP_HOST", "localhost")
APP_PORT = int(
    os.getenv("APP_PORT", 8000)
)  # Allocated to backend but also for access to the app, please change it in .env
DEFAULT_FRONTEND_PORT = (
    3000  # Not for access directly, but for proxying to the backend in development
)
STATIC_DIR = Path(os.getenv("STATIC_DIR", "static"))


class NodePackageManager(str):
    def __new__(cls, value: str) -> "NodePackageManager":
        return super().__new__(cls, value)

    @property
    def name(self) -> str:
        return Path(self).stem

    @property
    def is_pnpm(self) -> bool:
        return self.name == "pnpm"

    @property
    def is_npm(self) -> bool:
        return self.name == "npm"


def build():
    """
    Build the frontend and copy the static files to the backend.

    Raises:
        SystemError: If any build step fails
    """
    static_dir = Path("static")

    try:
        package_manager = _get_node_package_manager()
        _install_frontend_dependencies()

        rich.print("\n[bold]Building the frontend[/bold]")
        run([package_manager, "run", "build"], cwd=FRONTEND_DIR, check=True)

        if static_dir.exists():
            shutil.rmtree(static_dir)
        static_dir.mkdir(exist_ok=True)

        shutil.copytree(FRONTEND_DIR / "out", static_dir, dirs_exist_ok=True)

        rich.print(
            "\n[bold]Built frontend successfully![/bold]"
            "\n[bold]Run: 'poetry run prod' to start the app[/bold]"
            "\n[bold]Don't forget to update the .env file![/bold]"
        )
    except CalledProcessError as e:
        raise SystemError(f"Build failed during {e.cmd}") from e
    except Exception as e:
        raise SystemError(f"Build failed: {str(e)}") from e


def dev():
    asyncio.run(start_development_servers())


def prod():
    asyncio.run(start_production_server())


async def start_development_servers():
    """
    Start both frontend and backend development servers.
    Frontend runs with hot reloading, backend runs FastAPI server.

    Raises:
        SystemError: If either server fails to start
    """
    rich.print("\n[bold]Starting development servers[/bold]")

    try:
        processes = []
        if _is_frontend_included():
            frontend_process, frontend_port = await _run_frontend()
            processes.append(frontend_process)
            backend_process = await _run_backend(
                envs={
                    "ENVIRONMENT": "dev",
                    "FRONTEND_ENDPOINT": f"http://localhost:{frontend_port}",
                },
            )
            processes.append(backend_process)
        else:
            backend_process = await _run_backend(
                envs={"ENVIRONMENT": "dev"},
            )
            processes.append(backend_process)

        try:
            # Wait for processes to complete
            await asyncio.gather(*[process.wait() for process in processes])
        except (asyncio.CancelledError, KeyboardInterrupt):
            rich.print("\n[bold yellow]Shutting down...[/bold yellow]")
        finally:
            # Terminate both processes
            for process in processes:
                process.terminate()
                try:
                    await asyncio.wait_for(process.wait(), timeout=5)
                except asyncio.TimeoutError:
                    process.kill()

    except Exception as e:
        raise SystemError(f"Failed to start development servers: {str(e)}") from e


async def start_production_server():
    if _is_frontend_included():
        is_frontend_built = (FRONTEND_DIR / "out" / "index.html").exists()
        is_frontend_static_dir_exists = STATIC_DIR.exists()
        if not is_frontend_built or not is_frontend_static_dir_exists:
            build()

    try:
        process = await _run_backend(
            envs={"ENVIRONMENT": "prod"},
        )
        await process.wait()
    except Exception as e:
        raise SystemError(f"Failed to start production server: {str(e)}") from e
    finally:
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), timeout=5)
        except asyncio.TimeoutError:
            process.kill()


async def _run_frontend(
    port: int = DEFAULT_FRONTEND_PORT,
    timeout: int = 5,
) -> tuple[Process, int]:
    """
    Start the frontend development server and return its process and port.

    Returns:
        tuple[Process, int]: The frontend process and the port it's running on
    """
    # Install dependencies
    _install_frontend_dependencies()

    port = _find_free_port(start_port=DEFAULT_FRONTEND_PORT)
    package_manager = _get_node_package_manager()
    frontend_process = await asyncio.create_subprocess_exec(
        package_manager,
        "run",
        "dev",
        "--" if package_manager.is_npm else "",
        "-p",
        str(port),
        cwd=FRONTEND_DIR,
    )
    rich.print("\n[bold]Waiting for frontend to start...")
    # Block until the frontend is accessible
    for _ in range(timeout):
        await asyncio.sleep(1)
        if frontend_process.returncode is not None:
            raise RuntimeError("Could not start frontend dev server")
        if _is_server_running(port):
            rich.print(
                "\n[bold]Frontend dev server is running. Please wait a while for the app to be ready...[/bold]"
            )
            return frontend_process, port
    raise TimeoutError(f"Frontend dev server failed to start within {timeout} seconds")


async def _run_backend(
    envs: dict[str, str | None] = {},
) -> Process:
    """
    Start the backend development server.

    Returns:
        Process: The backend process
    """
    # Merge environment variables
    envs = {**os.environ, **(envs or {})}
    # Check if the port is free
    if not _is_port_available(APP_PORT):
        raise SystemError(
            f"Port {APP_PORT} is not available! Please change the port in .env file or kill the process running on this port."
        )
    rich.print(f"\n[bold]Starting app on port {APP_PORT}...[/bold]")
    poetry_executable = _get_poetry_executable()
    process = await asyncio.create_subprocess_exec(
        poetry_executable,
        "run",
        "python",
        "main.py",
        env=envs,
    )
    # Wait for port is started
    timeout = 30
    for _ in range(timeout):
        await asyncio.sleep(1)
        if process.returncode is not None:
            raise RuntimeError("Could not start backend dev server")
        if _is_server_running(APP_PORT):
            rich.print(
                f"\n[bold green]App is running. You now can access it at http://{APP_HOST}:{APP_PORT}[/bold green]"
            )
            return process
    # Timeout, kill the process
    process.terminate()
    raise TimeoutError(f"Backend dev server failed to start within {timeout} seconds")


def _install_frontend_dependencies():
    package_manager = _get_node_package_manager()
    rich.print(
        f"\n[bold]Installing frontend dependencies using {package_manager.name}. It might take a while...[/bold]"
    )
    run([package_manager, "install"], cwd=".frontend", check=True)


def _get_node_package_manager() -> NodePackageManager:
    """
    Check for available package managers and return the preferred one.
    Returns 'pnpm' if installed, falls back to 'npm'.
    Raises SystemError if neither is installed.

    Returns:
        str: The full path to the available package manager executable
    """
    # On Windows, we need to check for .cmd extensions
    pnpm_cmds = ["pnpm", "pnpm.cmd"]
    npm_cmds = ["npm", "npm.cmd"]

    for cmd in pnpm_cmds:
        cmd_path = which(cmd)
        if cmd_path is not None:
            return NodePackageManager(cmd_path)

    for cmd in npm_cmds:
        cmd_path = which(cmd)
        if cmd_path is not None:
            return NodePackageManager(cmd_path)

    raise SystemError(
        "Neither pnpm nor npm is installed. Please install Node.js and a package manager first."
    )


def _get_poetry_executable() -> str:
    """
    Check for available Poetry executables and return the preferred one.
    Returns 'poetry' if installed, falls back to 'poetry.cmd'.
    Raises SystemError if neither is installed.

    Returns:
        str: The full path to the available Poetry executable
    """
    poetry_cmds = ["poetry", "poetry.cmd"]
    for cmd in poetry_cmds:
        cmd_path = which(cmd)
        if cmd_path is not None:
            return cmd_path
    raise SystemError("Poetry is not installed. Please install Poetry first.")


def _is_port_available(port: int) -> bool:
    """Check if a port is available for binding."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.connect(("localhost", port))
            return False  # Port is in use, so not available
        except ConnectionRefusedError:
            return True  # Port is available
        except socket.error:
            return True  # Other socket errors likely mean port is available


def _is_server_running(port: int) -> bool:
    """Check if a server is running on the specified port."""
    return not _is_port_available(port)


def _find_free_port(start_port: int) -> int:
    """Find a free port starting from the given port number."""
    for port in range(start_port, 65535):
        if _is_port_available(port):
            return port
    raise SystemError("No free port found")


def _is_frontend_included() -> bool:
    """Check if the app has frontend"""
    return FRONTEND_DIR.exists()
