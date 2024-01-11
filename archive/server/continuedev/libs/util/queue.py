import asyncio
from typing import Dict

from ...models.websockets import WebsocketsMessage


class WebsocketsSubscriptionQueue:
    queues: Dict[str, asyncio.Queue] = {}

    def post(self, msg: WebsocketsMessage):
        if msg.message_id not in self.queues:
            self.queues.update({msg.message_id: asyncio.Queue()})

        self.queues[msg.message_id].put_nowait(msg)

    async def get(self, message_id: str) -> WebsocketsMessage:
        if message_id not in self.queues:
            self.queues.update({message_id: asyncio.Queue()})
        return await self.queues[message_id].get()

    async def delete(self, message_id: str):
        if message_id in self.queues:
            del self.queues[message_id]
