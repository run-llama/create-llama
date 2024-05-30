import inspect
from typing import Dict, List, Tuple
from llama_index.tools.openapi import OpenAPIToolSpec
from llama_index.tools.requests import RequestsToolSpec


class OpenAPIActionToolSpec(OpenAPIToolSpec, RequestsToolSpec):
    """
    A combination of OpenAPI and Requests tool specs that can parse OpenAPI specs and make requests.

    openapi_uri: str: The file path or URL to the OpenAPI spec.
    domain_headers: dict: Whitelist domains and the headers to use.
    """

    spec_functions = OpenAPIToolSpec.spec_functions + RequestsToolSpec.spec_functions

    def __init__(self, openapi_uri: str, domain_headers: dict = {}, **kwargs):
        # Load the OpenAPI spec
        openapi_spec, servers = self.load_openapi_spec(openapi_uri)

        # Add the servers to the domain headers if they are not already present
        for server in servers:
            if server not in domain_headers:
                domain_headers[server] = {}

        OpenAPIToolSpec.__init__(self, spec=openapi_spec)
        RequestsToolSpec.__init__(self, domain_headers)

    @staticmethod
    def load_openapi_spec(uri: str) -> Tuple[Dict, List[str]]:
        """
        Load an OpenAPI spec from a URI.

        Args:
            uri (str): A file path or URL to the OpenAPI spec.

        Returns:
            List[Document]: A list of Document objects.
        """
        import yaml
        from urllib.parse import urlparse

        if uri.startswith("http"):
            import requests

            response = requests.get(uri).text
            spec = yaml.safe_load(response)
        elif uri.startswith("file"):
            filepath = uri[7:]  # Remove the 'file://' scheme
            with open(filepath, "r") as file:
                spec = yaml.safe_load(file)
        else:
            raise ValueError(
                "Could not initialize OpenAPIActionToolSpec because invalid OpenAPI URI provided. "
                "Only HTTP and file path are supported."
            )
        # Add the servers to the whitelist
        servers = [urlparse(server["url"]).netloc for server in spec.get("servers", [])]
        return spec, servers
