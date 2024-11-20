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
DEFAULT_FRONTEND_PORT = 3000
STATIC_DIR = Path(os.getenv("STATIC_DIR", "static"))


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
        "-p",
        str(port),
        cwd=FRONTEND_DIR,
    )
    rich.print(
        f"\n[bold]Waiting for frontend to start, port: {port}, process id: {frontend_process.pid}[/bold]"
    )
    # Block until the frontend is accessible
    for _ in range(timeout):
        await asyncio.sleep(1)
        # Check if the frontend is accessible (port is open) or frontend_process is running
        if frontend_process.returncode is not None:
            raise RuntimeError("Could not start frontend dev server")
        if not _is_bindable_port(port):
            rich.print(
                f"\n[bold green]Frontend dev server is running on port {port}[/bold green]"
            )
            return frontend_process, port
    raise TimeoutError(f"Frontend dev server failed to start within {timeout} seconds")


async def _run_backend(
    envs: dict[str, str | None] = {},
) -> Process:
    """
    Start the backend development server.

    Args:
        frontend_port: The port number the frontend is running on
    Returns:
        Process: The backend process
    """
    # Merge environment variables
    envs = {**os.environ, **(envs or {})}
    rich.print("\n[bold]Starting backend FastAPI server...[/bold]")
    poetry_executable = _get_poetry_executable()
    return await asyncio.create_subprocess_exec(
        poetry_executable,
        "run",
        "python",
        "main.py",
        env=envs,
    )


def _install_frontend_dependencies():
    package_manager = _get_node_package_manager()
    rich.print(
        f"\n[bold]Installing frontend dependencies using {Path(package_manager).name}. It might take a while...[/bold]"
    )
    run([package_manager, "install"], cwd=".frontend", check=True)


def _get_node_package_manager() -> str:
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
            return cmd_path

    for cmd in npm_cmds:
        cmd_path = which(cmd)
        if cmd_path is not None:
            return cmd_path

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


def _is_bindable_port(port: int) -> bool:
    """Check if a port is available by attempting to connect to it."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            # Try to connect to the port
            s.connect(("localhost", port))
            # If we can connect, port is in use
            return False
        except ConnectionRefusedError:
            # Connection refused means port is available
            return True
        except socket.error:
            # Other socket errors also likely mean port is available
            return True


def _find_free_port(start_port: int) -> int:
    """
    Find a free port starting from the given port number.
    """
    for port in range(start_port, 65535):
        if _is_bindable_port(port):
            return port
    raise SystemError("No free port found")


def _is_frontend_included() -> bool:
    """Check if the app has frontend"""
    return FRONTEND_DIR.exists()
