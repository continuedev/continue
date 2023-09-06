from __future__ import print_function

import threading
import time


class LspEndpoint(threading.Thread):
    def __init__(self, json_rpc_endpoint, default_callback=print, callbacks={}):
        threading.Thread.__init__(self)
        self.json_rpc_endpoint = json_rpc_endpoint
        self.callbacks = callbacks
        self.default_callback = default_callback
        self.event_dict = {}
        self.response_dict = {}
        self.next_id = 0
        # self.daemon = True
        self.shutdown_flag = False

    def handle_result(self, jsonrpc_res):
        self.response_dict[jsonrpc_res["id"]] = jsonrpc_res
        cond = self.event_dict[jsonrpc_res["id"]]
        cond.acquire()
        cond.notify()
        cond.release()

    def stop(self):
        self.shutdown_flag = True

    def run(self):
        while not self.shutdown_flag:
            time.sleep(0.1)
            jsonrpc_message = self.json_rpc_endpoint.recv_response()

            if jsonrpc_message is None:
                print("server quit")
                break

            # print("recieved message:", jsonrpc_message)
            if "result" in jsonrpc_message or "error" in jsonrpc_message:
                self.handle_result(jsonrpc_message)
            elif "method" in jsonrpc_message:
                if jsonrpc_message["method"] in self.callbacks:
                    self.callbacks[jsonrpc_message["method"]](jsonrpc_message)
                else:
                    self.default_callback(jsonrpc_message)
            else:
                print("unknown jsonrpc message")
            # print(jsonrpc_message)

    def send_message(self, method_name, params, id=None):
        message_dict = {}
        message_dict["jsonrpc"] = "2.0"
        if id is not None:
            message_dict["id"] = id
        message_dict["method"] = method_name
        message_dict["params"] = params
        self.json_rpc_endpoint.send_request(message_dict)

    def call_method(self, method_name, **kwargs):
        current_id = self.next_id
        self.next_id += 1
        cond = threading.Condition()
        self.event_dict[current_id] = cond
        cond.acquire()
        self.send_message(method_name, kwargs, current_id)
        cond.wait()
        cond.release()
        # TODO: check if error, and throw an exception
        response = self.response_dict[current_id]
        return response["result"]

    def send_notification(self, method_name, **kwargs):
        self.send_message(method_name, kwargs)
