from .images import router as images_router
from .metadata import router as metadata_router
from .objects import router as objects_router
from .nasa import router as nasa_router
from .spherex import router as spherex_router
from .system import router as system_router
from .ai import router as ai_router
from .agent import demo_router as agent_demo_router
from .agent import router as agent_router

__all__ = [
    "images_router",
    "metadata_router",
    "objects_router",
    "nasa_router",
    "spherex_router",
    "system_router",
    "ai_router",
    "agent_router",
    "agent_demo_router",
]
