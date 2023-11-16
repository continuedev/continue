import asyncio
from datetime import datetime
import time
from typing import List, Optional

from openai import OpenAIError

import openai

from ..util.count_tokens import CONTEXT_LENGTH_FOR_MODEL
from openai import OpenAI
from pydantic import validator

from ...core.main import ChatMessage
from .base import LLM

from .proxy_server import ProxyServer


import json

class OpenAIAgent(LLM):
    """
    With the `OpenAIAgent` you use OpenAi's Agents.

    

    ```python title="~/.continue/config.py"
    from continuedev.libs.llm.openai_agent import OpenAIAgent
    API_KEY = "<API_KEY>"
    config = ContinueConfig(
        ...
        models=Models(
            default=OpenAI(
                api_key="EMPTY",
                model="gpt4_agent",
                api_base="http://localhost:8000", # change to your server
            )         
        )
    )
    ```

    The `OpenAIFreeTrial` class will automatically switch to using your API key instead of ours. If you'd like to explicitly use one or the other, you can use the `ProxyServer` or `OpenAI` classes instead.

    These classes support any models available through the OpenAI API, assuming your API key has access, including "gpt-4", "gpt-3.5-turbo", "gpt-3.5-turbo-16k", and "gpt-4-32k".

    """

    api_key: Optional[str] = None
    assistant_id: Optional[str] = None    
    llm: Optional[LLM] = None
    thread_id: Optional[str] = None
    project_dir: Optional[str] = None

    _client: Optional[OpenAI] = None
    _assistant: Optional[str] = None
    
    @validator("context_length")
    def context_length_for_model(cls, v, values):
        return CONTEXT_LENGTH_FOR_MODEL.get(values["model"], 128000)

    async def start(self, unique_id: Optional[str] = None):
        await super().start(unique_id=unique_id)        
        self._client = OpenAI(api_key=self.api_key)

        # TODO Need to add a config variable to be passed in
        self.assistant_id='thread_lCb2rKUzIOodcA3MZaZu61Bv'

        self.retrieve_or_create_assistant()
        self.thread_id = self._client.beta.threads.create().id
        print(f'created new thread {self.thread_id}')




    async def _stream_complete(self, prompt, options):
         async for chunk in self._stream_chat(
                [{"role": "user", "content": prompt}], options
            ):
                if "content" in chunk:
                    yield chunk["content"]



    async def _stream_chat(self, messages: List[ChatMessage], options):   

        self.last_message = self._client.beta.threads.messages.create(
            thread_id=self.thread_id,
            role=messages[-1]['role'],
            content=messages[-1]['content'],
        )

        run = self._client.beta.threads.runs.create(
        thread_id=self.thread_id,
        assistant_id=self._assistant.id,
        instructions=self.system_message
        )
        self.run_id=run.id

        # This is where we can pass the runner to the soon to be built OpenAIFunction Step
        # yield {
        #     "content": run.id,
        #     "role": 'openai.runner',
        # }


        run_result = self._client.beta.threads.runs.retrieve(
            thread_id=self.thread_id,
            run_id=self.run_id)
        print(run_result)

        # Loop until the status is 'completed'
        while run_result.status != 'completed':
            if run_result.status == 'failed':
                raise Exception(
                    f"Error result: {run_result.last_error}"
                )  
            if run_result.status == 'expired':
                raise Exception(
                    f"Expired result: {run_result.last_error}"
                )           
            if run_result.status == 'cancelled':
                yield {
                    "content": "Cancelled",
                    "role": 'user',
                }

            if run_result.required_action is not None:
                outputs =self.handle_required_actions(run_result)
                run_result=self._client.beta.threads.runs.submit_tool_outputs(
                    thread_id=self.thread_id,
                    run_id=self.run_id,
                    tool_outputs=outputs
                    )
            else:
                time.sleep(.2)  # Wait for 1 second before checking again to avoid rate limiting
                run_result = self._client.beta.threads.runs.retrieve(
                    thread_id=self.thread_id,
                    run_id=self.run_id
                )
            print(run_result.status)


        # Print the result
        self.print_results()


        result_msgs = self._client.beta.threads.messages.list(
            thread_id=self.thread_id,
            after=self.last_message.id,
            order='asc'
        )
        msg = result_msgs.data[0]

        timestamp = datetime.fromtimestamp(msg.created_at).strftime('%Y-%m-%d %H:%M:%S')        
        print (f'{timestamp} {msg.role}: {msg.content[0].text.value}')

        yield {
            "content": msg.content[0].text.value,
            "role": {msg.role},
        }

  



    def upload_file(self, file_path):
        return f'Here is where the file would be uploaded for {file_path}'


    def retrieve_or_create_assistant(self):
        try:
            self._assistant = self._client.beta.assistants.retrieve(self.assistant_id)
        except OpenAIError:
            self._assistant = self._client.beta.assistants.create(
                name="Continue Agent",
                instructions=OPENAI_AGENT_DEV_INSTRUCTIONS,
                model="gpt-4-1106-preview",
                tools=[{"type": "retrieval"}]
            )
            print(f"Created new assistant={self._assistant}")
        
        self._assistant = self._client.beta.assistants.update(
            assistant_id=self._assistant.id,
            tools=[{
                    "type": "function",
                    "function": {
                        "name": "get_project_file",
                        "description": "Returns the contents of the requested file",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "file_path": {"type": "string", "description": "The name must match one in file_list.txt file path"},                    
                            },
                            "required": ["file_path"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "get_current_time",
                        "description": "Returns the current data time in  ISO 8601 standard",
                        "parameters": {    
                            "type": "object",
                            "properties": {
                            
                            },                        
                            "required": []
                        }
                    }
                }               
            ]

        )
   

    def get_current_time(self):
        str= datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        print(f'get_current_time()={str}')
        return str

  

    def print_results(self):

        try:
            messages = self._client.beta.threads.messages.list(
            thread_id=self.thread_id
        )
        except openai.NotFoundError as e:
        # Handle the NotFoundError
            print(f"NotFoundError occurred: {e}")
        # Optionally, add additional logic to handle the error, like logging or default actions
        except Exception as e:
        # Catch other potential exceptions
            print(f"An unexpected error occurred: {e}")
        # Handle other exceptions or re-raise them

        for data_i, threadMessage in enumerate(messages.data):
            timestamp = datetime.fromtimestamp(threadMessage.created_at).strftime('%Y-%m-%d %H:%M:%S')        
            print (f'{timestamp} {threadMessage.role}: {threadMessage.content[0].text.value}')


    def get_project_file(self, args):
        file_path=args['file_path']
        return f'file contents goes here for {file_path}'


    # Define a function to handle the required actions
    def handle_required_actions(self, run):
        outputs = []
        if run.status == 'requires_action':
            required_action = run.required_action
            if required_action and required_action.type == 'submit_tool_outputs':
                
                tool_calls = required_action.submit_tool_outputs.tool_calls
                for call in tool_calls:
                    function_name = call.function.name
                    arguments = json.loads(call.function.arguments)
                    print(f'function_name={function_name} args={arguments}')
                    # Call the corresponding function based on the function name
                    if function_name == 'get_project_file':                        
                        outputs.append(
                            {
                                "tool_call_id": call.id,
                                "output": self.get_project_file(arguments),
                            }
                        )
                    elif function_name == 'get_current_time':                        
                        outputs.append(
                            {
                                "tool_call_id": call.id,
                                "output": self.get_current_time()
                            }
                        )                                        
                    else:
                        print(f"No handler for function: {function_name}")    
        
        return outputs
                                
OPENAI_AGENT_DEV_INSTRUCTIONS="""
# GOALS
* To act as an expert developer

* Determine if you have enough context to completely understand the issue

* If you need additional information you are to always ask for files, documentation or information via the Assistent Functions
"""