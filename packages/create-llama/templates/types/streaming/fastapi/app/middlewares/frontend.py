import logging
from typing import Set

import httpx
from fastapi import Request
from fastapi.responses import StreamingResponse

logger = logging.getLogger("uvicorn")


class FrontendProxyMiddleware:
    """
    Proxy requests to the frontend development server
    """

    def __init__(
        self,
        app,
        frontend_endpoint: str,
        excluded_paths: Set[str],
    ):
        self.app = app
        self.excluded_paths = excluded_paths
        self.frontend_endpoint = frontend_endpoint

    async def _request_frontend(
        self,
        request: Request,
        path: str,
        timeout: float = 60.0,
    ):
        async with httpx.AsyncClient(timeout=timeout) as client:
            url = f"{self.frontend_endpoint}/{path}"
            if request.query_params:
                url = f"{url}?{request.query_params}"

            headers = dict(request.headers)
            try:
                body = await request.body() if request.method != "GET" else None

                response = await client.request(
                    method=request.method,
                    url=url,
                    headers=headers,
                    content=body,
                    follow_redirects=True,
                )

                response_headers = dict(response.headers)
                response_headers.pop("content-encoding", None)
                response_headers.pop("content-length", None)

                return StreamingResponse(
                    response.iter_bytes(),
                    status_code=response.status_code,
                    headers=response_headers,
                )
            except Exception as e:
                logger.error(f"Proxy error: {str(e)}")
                raise

    def _is_excluded_path(self, path: str) -> bool:
        return any(
            path.startswith(excluded_path) for excluded_path in self.excluded_paths
        )

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        request = Request(scope, receive)
        path = request.url.path

        if self._is_excluded_path(path):
            return await self.app(scope, receive, send)

        response = await self._request_frontend(request, path.lstrip("/"))
        return await response(scope, receive, send)
