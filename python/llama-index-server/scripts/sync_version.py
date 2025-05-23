#!/usr/bin/env python3
import json
from pathlib import Path


def sync_versions():
    # Read package.json
    with open("package.json", "r") as f:
        package_data = json.load(f)
        npm_version = package_data["version"]

    # Read pyproject.toml
    pyproject_path = Path("pyproject.toml")
    content = pyproject_path.read_text()

    # Find the project section and update version
    sections = content.split("\n\n")
    for i, section in enumerate(sections):
        if section.startswith("[project]"):
            lines = section.split("\n")
            for j, line in enumerate(lines):
                if line.startswith("version = "):
                    lines[j] = f'version = "{npm_version}"'
            sections[i] = "\n".join(lines)
            break

    # Write back to pyproject.toml
    pyproject_path.write_text("\n\n".join(sections))
    print(f"Updated pyproject.toml version to {npm_version}")


if __name__ == "__main__":
    sync_versions()
