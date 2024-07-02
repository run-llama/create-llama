import os


def load_from_env(var: str, throw_error: bool = True) -> str:
    res = os.getenv(var)
    if res is None and throw_error:
        raise ValueError(f"Missing environment variable: {var}")
    return res