import asyncio
from datetime import datetime
import html
import json
from typing import List, Optional

from continuedev.libs.llm.base import CompletionOptions

# absolute import needed so instanceof works
from continuedev.core.main import ChatMessage, SetStep, Step
from continuedev.core.sdk import ContinueSDK, Models
from continuedev.libs.util.devdata import dev_data_logger
from continuedev.libs.util.strings import remove_quotes_and_escapes
from continuedev.libs.util.telemetry import posthog_logger
from openai import OpenAI

class OpenAIRunFunction(Step):
    run_id: str
    api_key: str
    thread_id: str

    async def describe(self, models: Models):
        return f"`OpenAI Thread Run Listener to respond to function requests for thread_id={self.dict['thread_id']}`."

    async def run(self, sdk: ContinueSDK):
        client = OpenAI(api_key=self.api_key)
        run_result = client.beta.threads.runs.retrieve(
            thread_id=self.thread_id,
            run_id=self.run_id)
        print(run_result)

        # Loop until the status is 'completed'
        while True :
            run_result = client.beta.threads.runs.retrieve(
                thread_id=self.thread_id,
                run_id=self.run_id
            )
            print(f'run_id={run_result.id} state={run_result.status}')
            if run_result.status in ('completed', 'failed', 'expired', 'cancelled'):
                return    
           
            if run_result.required_action is not None:
                outputs =self.handle_required_actions(run_result)
                run_result=client.beta.threads.runs.submit_tool_outputs(
                    thread_id=self.thread_id,
                    run_id=self.run_id,
                    tool_outputs=outputs
                    )
            else:
                await asyncio.sleep(.2)  
               
          

 

    def get_project_file(self, file_path):
        return f'Here is where the file would be uploaded for {file_path}'


    def get_current_time(self):
        str= datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        print(f'get_current_time()={str}')
        return str

        



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