import asyncio
from typing import Dict


class AsyncSubscriptionQueue:
    # The correct way to do this is probably to keep request IDs
    queues: Dict[str, asyncio.Queue] = {}

    def post(self, messageType: str, data: any):
        if messageType not in self.queues:
            self.queues.update({messageType: asyncio.Queue()})
        self.queues[messageType].put_nowait(data)

    async def get(self, message_type: str) -> any:
        if message_type not in self.queues:
            self.queues.update({message_type: asyncio.Queue()})
        return await self.queues[message_type].get()
