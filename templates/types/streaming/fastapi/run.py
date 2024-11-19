import asyncio
import shutil
import time
from asyncio.subprocess import Process
from pathlib import Path
from shutil import which
from subprocess import CalledProcessError, run

import psutil
import rich


def build():
    """
    Build the frontend and copy the static files to the backend.

    Raises:
        SystemError: If any build step fails
    """
    frontend_dir = Path(".frontend")
    static_dir = Path("static")

    try:
        package_manager = _get_node_package_manager()
        rich.print(
            f"\n[bold]Installing frontend dependencies using {Path(package_manager).name}. It might take a while...[/bold]"
        )
        # Use the full path to the package manager
        run([package_manager, "install"], cwd=frontend_dir, check=True)

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
    asyncio.run(start_development_servers())


def prod():
    # TODO: Implement production mode
    raise NotImplementedError("Production mode is not implemented yet")


async def start_development_servers():
    """
    Start both frontend and backend development servers.
    Frontend runs with hot reloading, backend runs FastAPI server.

    Raises:
        SystemError: If either server fails to start
    """
    rich.print("\n[bold]Starting development servers[/bold]")

    try:
        frontend_process, frontend_port = await _run_frontend()
        frontend_endpoint = f"http://localhost:{frontend_port}"
        backend_process = await _run_backend(frontend_endpoint)

        try:
            # Wait for processes to complete
            await asyncio.gather(frontend_process.wait(), backend_process.wait())
        except (asyncio.CancelledError, KeyboardInterrupt):
            rich.print("\n[bold yellow]Shutting down...[/bold yellow]")
        finally:
            # Terminate both processes
            for process in (frontend_process, backend_process):
                process.terminate()
                try:
                    await asyncio.wait_for(process.wait(), timeout=5)
                except asyncio.TimeoutError:
                    process.kill()

    except Exception as e:
        raise SystemError(f"Failed to start development servers: {str(e)}") from e


async def _run_frontend() -> tuple[Process, int]:
    """
    Start the frontend development server and return its process and port.

    Returns:
        tuple[Process, int]: The frontend process and the port it's running on
    """
    package_manager = _get_node_package_manager()
    frontend_process = await asyncio.create_subprocess_exec(
        package_manager,
        "run",
        "dev",
        cwd=".frontend",
    )
    rich.print(
        f"[bold]Waiting for frontend to start, process id: {frontend_process.pid}[/bold]"
    )
    frontend_port = await _get_process_port(frontend_process.pid)
    rich.print(
        f"\n[bold green]Frontend dev server running on port {frontend_port}[/bold green]"
    )
    return frontend_process, frontend_port


async def _run_backend(frontend_endpoint: str) -> Process:
    """
    Start the backend development server.

    Args:
        frontend_port: The port number the frontend is running on
    Returns:
        Process: The backend process
    """
    poetry_executable = _get_poetry_executable()
    return await asyncio.create_subprocess_exec(
        poetry_executable,
        "run",
        "python",
        "main.py",
        env={"FRONTEND_ENDPOINT": frontend_endpoint},
    )


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
    poetry_cmds = ["poetry", "poetry.cmd"]
    for cmd in poetry_cmds:
        cmd_path = which(cmd)
        if cmd_path is not None:
            return cmd_path
    raise SystemError("Poetry is not installed. Please install Poetry first.")


async def _get_process_port(pid: int, timeout: int = 30) -> int:
    """
    Get the port number that a process or its children are listening on.
    Specifically for Node.js frontend development servers.

    Args:
        pid: Process ID to check
        timeout: Maximum time to wait for port detection in seconds

    Returns:
        int: The port number the process is listening on

    Raises:
        TimeoutError: If no port is detected within the timeout period
        ProcessLookupError: If the process doesn't exist
    """
    start_time = time.time()

    while time.time() - start_time < timeout:
        try:
            # Get the parent process and all its children
            parent = psutil.Process(pid)
            processes = [parent] + parent.children(recursive=True)

            # Check each process for listening ports
            for process in processes:
                try:
                    connections = process.connections()
                    # Look for listening TCP connections
                    for conn in connections:
                        if conn.status == "LISTEN":
                            return conn.laddr.port
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue

        except (psutil.NoSuchProcess, psutil.AccessDenied):
            raise ProcessLookupError(f"Process {pid} not found or access denied")

        # Wait a bit before checking again
        await asyncio.sleep(0.5)

    raise TimeoutError(
        f"Could not detect port for process {pid} within {timeout} seconds"
    )
