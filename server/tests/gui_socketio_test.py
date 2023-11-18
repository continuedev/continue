import pytest
import socketio

# @pytest.mark.asyncio
# async def test_gui_socketio():
#     sio = socketio.AsyncClient()
#     await sio.connect(
#         "http://localhost:65432/gui/socket.io?window_id=test",
#         transports=["websocket", "polling"],
#     )
#     await sio.disconnect()
