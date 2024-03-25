import os
import importlib


def get_documents():
    # For each file in .loaders, import the module and call the get_documents function
    for loader in os.listdir(os.path.join(os.path.dirname(__file__), "loaders")):
        if loader.endswith(".py"):
            loader = loader[:-3]
            module = importlib.import_module(f"app.engine.loaders.{loader}")
            documents = module.get_documents()
            yield documents
