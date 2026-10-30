import tiktoken


def estimate_tokens(text: str) -> int:
    """Return a rough token estimate using the standard cl100k encoding."""
    encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text))