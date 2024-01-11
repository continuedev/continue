# This is a separate server from server/main.py
import json
from urllib.parse import parse_qs

import nest_asyncio
import socketio
from fastapi import APIRouter
from pydantic import ValidationError

from ..libs.util.errors import format_exc
from ..libs.util.logging import logger
from ..models.websockets import WebsocketsMessage
from .protocols.ide import WindowInfo
from .window_manager import window_manager

nest_asyncio.apply()


router = APIRouter(prefix="/ide", tags=["ide"])

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
sio_ide_app = socketio.ASGIApp(socketio_server=sio)


@sio.event
async def connect(sid, environ):
    query = parse_qs(environ.get("QUERY_STRING", ""))
    window_info_str = query.get("window_info", [None])[0]
    window_info = WindowInfo.parse_raw(window_info_str)

    await window_manager.register_ide(window_info, sio, sid)


@sio.event
async def disconnect(sid):
    window_manager.remove_ide(sid)


@sio.event
async def message(sid, data):
    try:
        if isinstance(data, str):
            data = json.loads(data)

        message = WebsocketsMessage.parse_obj(data)
    except json.JSONDecodeError:
        logger.critical(f"Error decoding json: {data}")
        return
    except ValidationError as e:
        tb = format_exc(e)
        logger.critical(f"Error validating json: {tb}")
        return

    try:
        if ide := window_manager.get_ide(sid):
            await ide.handle_json(message)
        else:
            logger.critical(f"IDE not found for sid {sid}")
    except Exception as e:
        tb = format_exc(e)
        logger.critical(f"Error handling message: {tb}")
        raise e
