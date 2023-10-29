import json
from urllib.parse import parse_qs
import socketio
from fastapi import APIRouter
from pydantic import ValidationError

from ..models.websockets import WebsocketsMessage
from ..libs.util.logging import logger
from .window_manager import window_manager

router = APIRouter(prefix="/gui", tags=["gui"])
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
sio_gui_app = socketio.ASGIApp(socketio_server=sio)


@sio.event
async def connect(sid, environ):
    query = parse_qs(environ.get("QUERY_STRING", ""))
    window_id = query.get("window_id", [None])[0]
    await window_manager.register_gui(window_id, sio, sid)


@sio.event
async def disconnect(sid):
    window_manager.remove_gui(sid)


@sio.event
async def message(sid, data):
    try:
        message = WebsocketsMessage.parse_obj(data)
    except json.JSONDecodeError:
        logger.critical(f"Error decoding json: {data}")
        return
    except ValidationError as e:
        logger.critical(f"Error validating json: {e}")
        return

    try:
        if gui := window_manager.get_gui(sid):
            await gui.handle_json(message)
        else:
            logger.critical(f"GUI websocket not found for sid {sid}")
    except Exception as e:
        logger.critical(f"Error handling message: {e}")
        raise e
