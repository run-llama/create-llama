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
    # Cached parsed specs by URI
    _specs: Dict[str, Tuple[Dict, List[str]]] = {}

    def __init__(self, openapi_uri: str, domain_headers: dict = None, **kwargs):
        if domain_headers is None:
            domain_headers = {}
        if openapi_uri not in self._specs:
            openapi_spec, servers = self._load_openapi_spec(openapi_uri)
            self._specs[openapi_uri] = (openapi_spec, servers)
        else:
            openapi_spec, servers = self._specs[openapi_uri]

        # Add the servers to the domain headers if they are not already present
        for server in servers:
            if server not in domain_headers:
                domain_headers[server] = {}

        OpenAPIToolSpec.__init__(self, spec=openapi_spec)
        RequestsToolSpec.__init__(self, domain_headers)

    @staticmethod
    def _load_openapi_spec(uri: str) -> Tuple[Dict, List[str]]:
        """
        Load an OpenAPI spec from a URI.

        Args:
            uri (str): A file path or URL to the OpenAPI spec.

        Returns:
            List[Document]: A list of Document objects.
        """
        from urllib.parse import urlparse

        import yaml  # type: ignore

        if uri.startswith("http"):
            import requests  # type: ignore

            response = requests.get(uri)
            if response.status_code != 200:
                raise ValueError(
                    "Could not initialize OpenAPIActionToolSpec: "
                    f"Failed to load OpenAPI spec from {uri}, status code: {response.status_code}"
                )
            spec = yaml.safe_load(response.text)
        elif uri.startswith("file"):
            filepath = urlparse(uri).path
            with open(filepath, "r") as file:
                spec = yaml.safe_load(file)
        else:
            raise ValueError(
                "Could not initialize OpenAPIActionToolSpec: Invalid OpenAPI URI provided. "
                "Only HTTP and file path are supported."
            )
        # Add the servers to the whitelist
        try:
            servers = [
                urlparse(server["url"]).netloc for server in spec.get("servers", [])
            ]
        except KeyError as e:
            raise ValueError(
                "Could not initialize OpenAPIActionToolSpec: Invalid OpenAPI spec provided. "
                "Could not get `servers` from the spec."
            ) from e
        return spec, servers
