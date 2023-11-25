import asyncio
from datetime import datetime
import html
import json
import os
from typing import List, Optional
from continuedev.libs.index.chunkers.chunk_directory import get_all_filepaths

from continuedev.libs.llm.base import CompletionOptions

# absolute import needed so instanceof works
from continuedev.core.main import ChatMessage, SetStep, Step
from continuedev.core.sdk import ContinueSDK, Models
from continuedev.libs.util.devdata import dev_data_logger
from continuedev.libs.util.strings import remove_quotes_and_escapes
from continuedev.libs.util.telemetry import posthog_logger
from continuedev.plugins.context_providers.file import get_file_contents
from openai import OpenAI
from continuedev.plugins.context_providers.search import SearchContextProvider
from tqdm import tqdm

class OpenAIRunFunction(Step):
    run_id: str
    api_key: str
    thread_id: str
    user_input: str

    async def describe(self, models: Models):
        return f"`OpenAI Thread Run Listener to respond to function requests for thread_id={self.dict['thread_id']}`."

    async def run(self, sdk: ContinueSDK):
        client = OpenAI(api_key=self.api_key)
        run_result = client.beta.threads.runs.retrieve(
            thread_id=self.thread_id,
            run_id=self.run_id)
        print(f'OpenAIRunFunction run_id={run_result.id} state={run_result.status}  STARTED')
        pbar = tqdm(total=100, desc=f'Run({self.run_id})', unit=" update", leave=True)

        # Loop until the status is 'completed'
        while True :
            run_result = client.beta.threads.runs.retrieve(
                thread_id=self.thread_id,
                run_id=self.run_id
            )
            #print(f'run_id={run_result.id} state={run_result.status}')
            if run_result.status in ('completed', 'failed', 'expired', 'cancelled'):
                print(f'OpenAIRunFunction run_id={run_result.id} state={run_result.status}  COMPLETED')

                return    
           
            if run_result.required_action is not None:
                outputs =await self.handle_required_actions(sdk, run_result)
                run_result=client.beta.threads.runs.submit_tool_outputs(
                    thread_id=self.thread_id,
                    run_id=self.run_id,
                    tool_outputs=outputs
                    )
            else:  
                pbar.update(1)                
                await asyncio.sleep(.2)  
               
          

 
    async def list_project_files(self, sdk):
        files, should_ignore = await get_all_filepaths(sdk.ide)
        relative_filepaths = [os.path.relpath(path, sdk.ide.workspace_directory) for path in files]
        return  '\n'.join(relative_filepaths)

        #return f'Here is where the file would be uploaded for {file_path}'

    async def get_project_file(self, sdk, file_path):
        abs_path = os.path.join(sdk.ide.workspace_directory, file_path)
        contents = await get_file_contents(abs_path, sdk.ide)    
        if len(contents) == 0:
            contents=f'file not found {abs_path}'
        
        return contents
        #return f'Here is where the file would be uploaded for {file_path}'


    def get_current_time(self):
        str= datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        print(f'get_current_time()={str}')
        return str

        



    # Define a function to handle the required actions
    async def handle_required_actions(self, sdk, run):
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
                        contents = await self.get_project_file(sdk, arguments['file_path'])
                        print(f'get_project_file=\n{contents}')
                        outputs.append(
                            {
                                "tool_call_id": call.id,
                                "output": contents,
                            }
                        )
                    elif function_name == 'get_current_time':   
                        current_time = self.get_current_time()  
                        print(f'get_current_time=\n{current_time}')                   
                        outputs.append(
                            {
                                "tool_call_id": call.id,
                                "output": current_time
                            }
                        )   
                    elif function_name == 'list_project_files':   
                        files = await self.list_project_files(sdk)
                        print(f'list_project_files=\n{files}')             
                        outputs.append(
                            {
                                "tool_call_id": call.id,
                                "output": files
                            }
                        )                                     
                    else:
                        print(f"No handler for function: {function_name}")    
        
        return outputs