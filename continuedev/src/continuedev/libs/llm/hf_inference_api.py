# from typing import List, Optional

# import aiohttp
# import requests

# from ...core.main import ChatMessage
from ..llm import LLM, CompletionOptions
# from .prompts.edit import simplified_edit_prompt
from huggingface_hub import InferenceClient

# DEFAULT_MAX_TIME = 120.0


class HuggingFaceInferenceAPI(LLM):
    model: str = "Hugging Face Inference API"
    hf_token: str
    endpoint_url: str = None

    # verify_ssl: Optional[bool] = None

    # _client_session: aiohttp.ClientSession = None

    # prompt_templates = {
    #    "edit": simplified_edit_prompt,
    # }

    class Config:
        arbitrary_types_allowed = True
    
    '''
    async def start(self, **kwargs):
        await super().start(**kwargs)
        self._client_session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl),
            timeout=aiohttp.ClientTimeout(total=self.timeout),
        )

    async def stop(self):
        await self._client_session.close()


    async def _complete(self, prompt: str, options):
        """Return the completion of the text with the given temperature."""
        API_URL = (
            self.base_url or f"https://api-inference.huggingface.co/models/{self.model}"
        )
        headers = {"Authorization": f"Bearer {self.hf_token}"}

        response = requests.post(
            API_URL,
            headers=headers,
            json={
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": min(
                        250, self.max_context_length - self.count_tokens(prompt)
                    ),
                    "max_time": DEFAULT_MAX_TIME,
                    "return_full_text": False,
                },
            },
        )
        data = response.json()

        # Error if the response is not a list
        if not isinstance(data, list):
            raise Exception("Hugging Face returned an error response: \n\n", data)

        return data[0]["generated_text"]

    async def _stream_chat(self, messages: List[ChatMessage], options):
        response = await self._complete(messages[-1].content, messages[:-1])
        yield {"content": response, "role": "assistant"}

    '''

    def collect_args(self, options: CompletionOptions):
        options.stop = None
        args = super().collect_args(options)

        if "max_tokens" in args:
            args["max_new_tokens"] = args["max_tokens"]
            del args["max_tokens"]
        if "stop" in args:
            args["stop_sequences"] = args["stop"]
            del args["stop"]
        return args


    async def _stream_complete(self, prompt, options):
        # response = await self._complete(prompt, options)
        # yield response

        args = self.collect_args(options)

        client = InferenceClient(self.endpoint_url, token=self.hf_token)

        stream = client.text_generation(prompt, stream=True, details=True, **args)

        for r in stream:

            # skip special tokens
            if 'special' in r.token:
                if r.token.special:
                    continue
            
            # stop if we encounter a stop sequence
            if 'text' in r.token:
                if r.token.text in gen_kwargs["stop_sequences"]:
                    break
            
            # yield the generated token
            if 'text' in r.token:
                # print(r.token['text'], end = "")
                yield r.token.text