# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
# This script is used to copy/link static files for the llama-index-server
# The frontend assets are now sourced from node_modules/@llamaindex/server
import os
import subprocess
import argparse
import shutil


def _get_pnpm_executable() -> str:
    """Determines the correct pnpm executable (pnpm or pnpm.cmd) and returns it.
    Exits if pnpm is not found."""
    pnpm_exe = shutil.which("pnpm")
    if pnpm_exe:
        return pnpm_exe
    pnpm_cmd_exe = shutil.which("pnpm.cmd")
    if pnpm_cmd_exe:
        return pnpm_cmd_exe
    print("pnpm not found. Please ensure pnpm is installed and in your PATH.")
    exit(1)


def check_pnpm_installation() -> None:
    pnpm_exe = _get_pnpm_executable()
    try:
        subprocess.run(
            [pnpm_exe, "--version"], check=True, capture_output=True
        )  # capture_output to silence stdout on success
    except subprocess.CalledProcessError:
        # This case might be redundant if _get_pnpm_executable exits,
        # but kept for robustness in case _get_pnpm_executable is changed.
        print(
            "pnpm is installed, but '--version' command failed. Please check your pnpm installation."
        )
        exit(1)


def get_workspace_path() -> str:
    pnpm_exe = _get_pnpm_executable()
    # Get the absolute path of the workspace
    # by running `pnpm root -w`
    try:
        output = (
            subprocess.check_output([pnpm_exe, "root", "-w"]).decode("utf-8").strip()
        )
    except subprocess.CalledProcessError as e:
        print(f"Failed to get workspace path using 'pnpm root -w': {e}")
        print("Ensure you are in a pnpm workspace and pnpm is functioning correctly.")
        exit(1)
    # remove 'node_modules' at the end of the path if it exists
    if output.endswith("node_modules"):
        return output[:-12]
    return output


def get_paths() -> tuple[str, str, str]:
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Go up one level to get to python/llama-index-server directory
    server_dir = os.path.dirname(script_dir)

    # Look for assets in the local node_modules directory
    fe_assets_dir = os.path.join(
        server_dir, "node_modules", "@llamaindex", "server", "dist", "static"
    )

    # Link path within the same server directory
    link_path = os.path.join(
        server_dir,
        "llama_index",
        "server",
        "resources",
        "ui",
    )
    return server_dir, fe_assets_dir, link_path


def link_static_files() -> None:
    """
    Only works for POSIX systems.
    Instead of copying the static files, we can link them.
    This is useful for development purposes.
    """
    # Link the static files to the llama-index-server directory
    # If user is on Windows, tell them to use WSL
    if os.name == "nt":
        print("Windows is not supported. Please use WSL to run this script.")
        exit(1)
    print("Linking static files...")
    # Need to link by absolute path of the server directory
    workspace_path, fe_assets_dir, link_path = get_paths()
    # Check
    if not os.path.exists(fe_assets_dir):
        print(
            f"Frontend assets directory {fe_assets_dir} does not exist. Please ensure @llamaindex/server is installed."
        )
        exit(1)
    if os.path.exists(link_path):
        if os.path.islink(link_path):
            os.unlink(link_path)
        else:
            shutil.rmtree(link_path)
    # Link the static files to the server directory
    subprocess.run(["ln", "-s", fe_assets_dir, link_path], check=True)
    print("Static files linked successfully.")


def copy_static_files() -> None:
    # Copy the static files to the output directory
    workspace_path, fe_assets_dir, link_path = get_paths()
    # Check if source directory exists
    if not os.path.exists(fe_assets_dir):
        print(
            f"Frontend assets directory {fe_assets_dir} does not exist. Please ensure @llamaindex/server is installed."
        )
        exit(1)
    # Remove the ui directory if it exists
    if os.path.exists(link_path):
        if os.path.islink(link_path):
            os.unlink(link_path)
        else:
            shutil.rmtree(link_path)
    # Copy the static files to the output directory
    shutil.copytree(fe_assets_dir, link_path, dirs_exist_ok=True)
    print("Static files copied successfully.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Prepare the frontend static files for the llama-index-server"
    )
    parser.add_argument(
        "--mode",
        choices=["link", "copy"],
        default="copy",
        help="Link the static files instead of copying them. Only works for POSIX systems.",
    )
    args = parser.parse_args()
    check_pnpm_installation()
    if args.mode == "link":
        link_static_files()
    else:
        copy_static_files()
