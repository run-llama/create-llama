# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
# This script is used to build the frontend for the llama-index-server
# You need to have pnpm installed to run this script
import os
import subprocess
import argparse
import shutil


def check_pnpm_installation():
    try:
        subprocess.run(["pnpm", "--version"], check=True)
    except subprocess.CalledProcessError:
        print("pnpm is not installed. Please install pnpm and try again.")
        exit(1)


def get_workspace_path() -> str:
    # Get the absolute path of the workspace
    # by running `pnpm root -w`
    output = subprocess.check_output(["pnpm", "root", "-w"]).decode("utf-8").strip()
    # remove 'node_modules' at the end of the path if it exists
    if output.endswith("node_modules"):
        return output[:-12]
    return output


def build_frontend():
    # Build Frontend
    print("Building Frontend...")
    # TODO: This probably can be copied from node_modules to save time
    # but it could be an issue if the user haven't run `pnpm build` for server package
    subprocess.run(["pnpm", "--filter", "@llamaindex/server", "build"], check=True)
    print("Frontend built successfully.")


def get_paths() -> tuple[str, str, str]:
    workspace_path = get_workspace_path()
    fe_assets_dir = os.path.join(workspace_path, "packages", "server", "dist", "static")
    link_path = os.path.join(
        workspace_path,
        "python",
        "llama-index-server",
        "llama_index",
        "server",
        "resources",
        "ui",
    )
    return workspace_path, fe_assets_dir, link_path


def link_static_files():
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
            f"Frontend assets directory {fe_assets_dir} does not exist. Please build the frontend first."
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


def copy_static_files():
    # Copy the static files to the output directory
    workspace_path, fe_assets_dir, link_path = get_paths()
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
        description="Prepare the frontend for the llama-index-server"
    )
    parser.add_argument(
        "--mode",
        choices=["link", "copy"],
        default="copy" if os.name == "nt" else "link",
        help="Link the static files instead of copying them. Only works for POSIX systems.",
    )
    parser.add_argument(
        "--skip-build", action="store_true", help="Skip the build step."
    )
    args = parser.parse_args()
    check_pnpm_installation()
    if not args.skip_build:
        build_frontend()
    if args.mode == "link":
        link_static_files()
    else:
        copy_static_files()
