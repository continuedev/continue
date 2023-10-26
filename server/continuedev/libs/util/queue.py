import asyncio
from typing import Dict


class AsyncSubscriptionQueue:
    queues: Dict[str, asyncio.Queue] = {}

    def post(self, messageType: str, data: any):
        if messageType not in self.queues:
            self.queues.update({messageType: asyncio.Queue()})
        self.queues[messageType].put_nowait(data)

    async def get(self, message_type: str) -> any:
        if message_type not in self.queues:
            self.queues.update({message_type: asyncio.Queue()})
        return await self.queues[message_type].get()

    async def delete(self, message_type: str):
        if message_type in self.queues:
            del self.queues[message_type]
