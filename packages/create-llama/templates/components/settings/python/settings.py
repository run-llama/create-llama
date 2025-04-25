import os
from typing import Dict, Optional

from llama_index.core.multi_modal_llms import MultiModalLLM
from llama_index.core.settings import Settings

# `Settings` does not support setting `MultiModalLLM`
# so we use a global variable to store it
_multi_modal_llm: Optional[MultiModalLLM] = None


def get_multi_modal_llm():
    return _multi_modal_llm


def init_settings():
    model_provider = os.getenv("MODEL_PROVIDER")
    match model_provider:
        case "openai":
            init_openai()
        case "groq":
            init_groq()
        case "ollama":
            init_ollama()
        case "anthropic":
            init_anthropic()
        case "gemini":
            init_gemini()
        case "mistral":
            init_mistral()
        case "azure-openai":
            init_azure_openai()
        case "huggingface":
            init_huggingface()
        case "t-systems":
            from .llmhub import init_llmhub

            init_llmhub()
        case _:
            raise ValueError(f"Invalid model provider: {model_provider}")

    Settings.chunk_size = int(os.getenv("CHUNK_SIZE", "1024"))
    Settings.chunk_overlap = int(os.getenv("CHUNK_OVERLAP", "20"))


def init_ollama():
    try:
        from llama_index.embeddings.ollama import OllamaEmbedding
        from llama_index.llms.ollama.base import DEFAULT_REQUEST_TIMEOUT, Ollama
    except ImportError:
        raise ImportError(
            "Ollama support is not installed. Please install it with `poetry add llama-index-llms-ollama` and `poetry add llama-index-embeddings-ollama`"
        )

    base_url = os.getenv("OLLAMA_BASE_URL") or "http://127.0.0.1:11434"
    request_timeout = float(
        os.getenv("OLLAMA_REQUEST_TIMEOUT", DEFAULT_REQUEST_TIMEOUT)
    )
    Settings.embed_model = OllamaEmbedding(
        base_url=base_url,
        model_name=os.getenv("EMBEDDING_MODEL"),
    )
    Settings.llm = Ollama(
        base_url=base_url, model=os.getenv("MODEL"), request_timeout=request_timeout
    )


def init_openai():
    from llama_index.core.constants import DEFAULT_TEMPERATURE
    from llama_index.embeddings.openai import OpenAIEmbedding
    from llama_index.llms.openai import OpenAI
    from llama_index.multi_modal_llms.openai import OpenAIMultiModal
    from llama_index.multi_modal_llms.openai.utils import GPT4V_MODELS

    max_tokens = os.getenv("LLM_MAX_TOKENS")
    model_name = os.getenv("MODEL", "gpt-4o-mini")
    Settings.llm = OpenAI(
        model=model_name,
        temperature=float(os.getenv("LLM_TEMPERATURE", DEFAULT_TEMPERATURE)),
        max_tokens=int(max_tokens) if max_tokens is not None else None,
    )

    if model_name in GPT4V_MODELS:
        global _multi_modal_llm
        _multi_modal_llm = OpenAIMultiModal(model=model_name)

    dimensions = os.getenv("EMBEDDING_DIM")
    Settings.embed_model = OpenAIEmbedding(
        model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"),
        dimensions=int(dimensions) if dimensions is not None else None,
    )


def init_azure_openai():
    from llama_index.core.constants import DEFAULT_TEMPERATURE

    try:
        from llama_index.embeddings.azure_openai import AzureOpenAIEmbedding
        from llama_index.llms.azure_openai import AzureOpenAI
    except ImportError:
        raise ImportError(
            "Azure OpenAI support is not installed. Please install it with `poetry add llama-index-llms-azure-openai` and `poetry add llama-index-embeddings-azure-openai`"
        )

    llm_deployment = os.environ["AZURE_OPENAI_LLM_DEPLOYMENT"]
    embedding_deployment = os.environ["AZURE_OPENAI_EMBEDDING_DEPLOYMENT"]
    max_tokens = os.getenv("LLM_MAX_TOKENS")
    temperature = os.getenv("LLM_TEMPERATURE", DEFAULT_TEMPERATURE)
    dimensions = os.getenv("EMBEDDING_DIM")

    azure_config = {
        "api_key": os.environ["AZURE_OPENAI_API_KEY"],
        "azure_endpoint": os.environ["AZURE_OPENAI_ENDPOINT"],
        "api_version": os.getenv("AZURE_OPENAI_API_VERSION")
        or os.getenv("OPENAI_API_VERSION"),
    }

    Settings.llm = AzureOpenAI(
        model=os.getenv("MODEL"),
        max_tokens=int(max_tokens) if max_tokens is not None else None,
        temperature=float(temperature),
        deployment_name=llm_deployment,
        **azure_config,
    )

    Settings.embed_model = AzureOpenAIEmbedding(
        model=os.getenv("EMBEDDING_MODEL"),
        dimensions=int(dimensions) if dimensions is not None else None,
        deployment_name=embedding_deployment,
        **azure_config,
    )


def init_fastembed():
    try:
        from llama_index.embeddings.fastembed import FastEmbedEmbedding
    except ImportError:
        raise ImportError(
            "FastEmbed support is not installed. Please install it with `poetry add llama-index-embeddings-fastembed`"
        )

    embed_model_map: Dict[str, str] = {
        # Small and multilingual
        "all-MiniLM-L6-v2": "sentence-transformers/all-MiniLM-L6-v2",
        # Large and multilingual
        "paraphrase-multilingual-mpnet-base-v2": "sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
    }

    embedding_model = os.getenv("EMBEDDING_MODEL")
    if embedding_model is None:
        raise ValueError("EMBEDDING_MODEL environment variable is not set")

    # This will download the model automatically if it is not already downloaded
    Settings.embed_model = FastEmbedEmbedding(
        model_name=embed_model_map[embedding_model]
    )


def init_huggingface_embedding():
    try:
        from llama_index.embeddings.huggingface import HuggingFaceEmbedding
    except ImportError:
        raise ImportError(
            "Hugging Face support is not installed. Please install it with `poetry add llama-index-embeddings-huggingface`"
        )

    embedding_model = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    backend = os.getenv("EMBEDDING_BACKEND", "onnx")  # "torch", "onnx", or "openvino"
    trust_remote_code = (
        os.getenv("EMBEDDING_TRUST_REMOTE_CODE", "false").lower() == "true"
    )

    Settings.embed_model = HuggingFaceEmbedding(
        model_name=embedding_model,
        trust_remote_code=trust_remote_code,
        backend=backend,
    )


def init_huggingface():
    try:
        from llama_index.llms.huggingface import HuggingFaceLLM
    except ImportError:
        raise ImportError(
            "Hugging Face support is not installed. Please install it with `poetry add llama-index-llms-huggingface` and `poetry add llama-index-embeddings-huggingface`"
        )

    Settings.llm = HuggingFaceLLM(
        model_name=os.getenv("MODEL"),
        tokenizer_name=os.getenv("MODEL"),
    )
    init_huggingface_embedding()


def init_groq():
    try:
        from llama_index.llms.groq import Groq
    except ImportError:
        raise ImportError(
            "Groq support is not installed. Please install it with `poetry add llama-index-llms-groq`"
        )

    Settings.llm = Groq(model=os.getenv("MODEL"))
    # Groq does not provide embeddings, so we use FastEmbed instead
    init_fastembed()


def init_anthropic():
    try:
        from llama_index.llms.anthropic import Anthropic
    except ImportError:
        raise ImportError(
            "Anthropic support is not installed. Please install it with `poetry add llama-index-llms-anthropic`"
        )

    model_map: Dict[str, str] = {
        "claude-3-opus": "claude-3-opus-20240229",
        "claude-3-sonnet": "claude-3-sonnet-20240229",
        "claude-3-haiku": "claude-3-haiku-20240307",
        "claude-2.1": "claude-2.1",
        "claude-instant-1.2": "claude-instant-1.2",
    }

    Settings.llm = Anthropic(model=model_map[os.getenv("MODEL")])
    # Anthropic does not provide embeddings, so we use FastEmbed instead
    init_fastembed()


def init_gemini():
    try:
        from llama_index.embeddings.gemini import GeminiEmbedding
        from llama_index.llms.gemini import Gemini
    except ImportError:
        raise ImportError(
            "Gemini support is not installed. Please install it with `poetry add llama-index-llms-gemini` and `poetry add llama-index-embeddings-gemini`"
        )

    model_name = f"models/{os.getenv('MODEL')}"
    embed_model_name = f"models/{os.getenv('EMBEDDING_MODEL')}"

    Settings.llm = Gemini(model=model_name)
    Settings.embed_model = GeminiEmbedding(model_name=embed_model_name)


def init_mistral():
    from llama_index.embeddings.mistralai import MistralAIEmbedding
    from llama_index.llms.mistralai import MistralAI

    Settings.llm = MistralAI(model=os.getenv("MODEL"))
    Settings.embed_model = MistralAIEmbedding(model_name=os.getenv("EMBEDDING_MODEL"))
