import asyncio
from datetime import datetime
import time
import os
from typing import List, Optional
from continuedev.libs.util.paths import getGlobalFolderPath


from openai import OpenAIError

import openai
import sqlite3


from continuedev.libs.util.count_tokens import CONTEXT_LENGTH_FOR_MODEL
from openai import OpenAI
from pydantic import validator
from continuedev.core.main import ChatMessage, SetStep
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
        disable_summaries=True,
        ...
        models=Models(
            default=OpenAI(
                api_key="EMPTY",
                model="gpt35turbo",
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
    project_dir: Optional[str] = None

    _client: Optional[OpenAI] = None
    _assistant: Optional[str] = None
    _run_id: Optional[str] = None

    _conn: Optional[sqlite3.connect] = None
    _session_2_thread_map: dict = {}
    
    @validator("context_length")
    def context_length_for_model(cls, v, values):
        return CONTEXT_LENGTH_FOR_MODEL.get(values["model"], 128000)

    async def start(self, unique_id: Optional[str] = None):
        await super().start(unique_id=unique_id)        
        self._client = OpenAI(api_key=self.api_key)

        self.retrieve_or_create_assistant()
        self.title = self._assistant.name


        db = os.path.join(getGlobalFolderPath(), 'continue_server.db')
        self._conn = sqlite3.connect(db)
        self.load_threads_map()
        #print(f'URL https://platform.openai.com/playground?assistant={self.assistant_id}&mode=assistant&thread={self.thread_id}')
       



    async def _stream_complete(self, prompt, options):
        return
      
    


    async def _stream_chat(self, messages: List[ChatMessage], options):   
        if options.session_id is None:
            print ("session_id is None")
            return

        thread_id= self.get_thread(options.session_id)

        self.last_message = self._client.beta.threads.messages.create(
            thread_id=thread_id,
            role=messages[-1]['role'],
            content=messages[-1]['content'],
        )


        run = self._client.beta.threads.runs.create(
        thread_id=thread_id,
        assistant_id=self._assistant.id,
        instructions=self.system_message
        )
        self._run_id=run.id

        # This is where we can pass the runner to the soon to be built OpenAIFunction Step       
        from continuedev.plugins.steps.openai_run_func import OpenAIRunFunction
        yield OpenAIRunFunction(
            run_id= self._run_id, 
            thread_id= thread_id,
            api_key= self.api_key,
            user_input=f'/open_ai_run_func {run.id} {thread_id} {self.api_key}'
        )


       
            
        # Loop until the status is 'completed'
        while True:
            run_result = self._client.beta.threads.runs.retrieve(
                thread_id=thread_id,
                run_id=self._run_id)            
            
 
            if run_result.status == 'failed':
                raise Exception(
                    f"Error result: {run_result.last_error}"
                )  
            elif run_result.status == 'expired':
                raise Exception(
                    f"Expired result: {run_result.last_error}"
                )           
            elif run_result.status == 'cancelled':
                yield {
                    "content": "Cancelled",
                    "role": 'user',
                }
            elif run_result.status == 'completed':
                break

            await asyncio.sleep(.2)  # Wait for 1 second before checking again to avoid rate limiting                     

        # Print the result
        #self.print_results(thread_id)


        result_msgs = self._client.beta.threads.messages.list(
            thread_id=thread_id,
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

 

    def retrieve_or_create_assistant(self):
        try:
            self._assistant = self._client.beta.assistants.retrieve(self.assistant_id)
            print(f"LOADING existing assistant={self._assistant.id} name={self._assistant.name}")
        except OpenAIError:
            try:
                self._assistant = self._client.beta.assistants.create(
                    name=self.title,
                    instructions=OPENAI_AGENT_DEV_INSTRUCTIONS,
                    model=self.model,
                    tools=[{"type": "retrieval"}]
                )
                print(f"CREATING new assistant={self._assistant.id} name={self._assistant.name}")
            except OpenAIError as e:
                print(f"Error creating assistant: {e}")

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
                },
                {
                    "type": "function",
                    "function": {
                        "name": "list_project_files",
                        "description": "Returns a list of all the files in the project",
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
   

    def print_results(self, thread_id):

        try:
            messages = self._client.beta.threads.messages.list(thread_id=thread_id )
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

    def get_thread(self, session_id):
        thread_id = self._session_2_thread_map.get(session_id, None)
        
        if thread_id is None:
            cursor = self._conn.cursor()
            for row in cursor.execute(f"SELECT * FROM threads where session_id='{session_id}'"):
                thread_id, session_id = row[0], row[1]
                print(f"LOADING existing thread={thread_id} for session_id={session_id}")
                self._session_2_thread_map[session_id] = thread_id

            if thread_id is None:
                thread_id = self.create_thread(session_id)
        else:
            print(f'CACHED thread_id={thread_id}  for session_id={session_id}')

 
        # Cleanup any existing runs on thread that are still running
        runs = self._client.beta.threads.runs.list(thread_id)
        for run in runs:
            if run.status in ('queued', 'in_progress', 'requires_action', 'cancelling'):
                self._client.beta.threads.runs.cancel(
                    thread_id=run.thread_id,
                    run_id=run.id
                )
                print(f'CANCELING existing thread={run.thread_id}')

        return thread_id         


    
    def load_threads_map(self):
        cursor = self._conn.cursor()
        cursor.execute('''CREATE TABLE IF NOT EXISTS threads (thread_id text, session_id text)''')
        self._conn.commit()
            
                                
    def create_thread(self, session_id):
        thread_id = self._client.beta.threads.create().id
        print(f"CREATING new thread={thread_id} session_id={session_id}")
        
        cursor = self._conn.cursor()
        cursor.execute(f"INSERT INTO threads VALUES ('{thread_id}','{session_id}')")        

        self._conn.commit()
        return thread_id

                                

OPENAI_AGENT_DEV_INSTRUCTIONS="""
# GOALS
* To act as an expert developer

* Determine if you have enough context to completely understand the issue

* If you need additional information you are to always ask for files, documentation or information via the Assistent Functions
"""