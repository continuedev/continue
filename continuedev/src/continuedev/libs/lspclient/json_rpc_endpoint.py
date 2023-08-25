from __future__ import print_function

import json
import re
import threading

JSON_RPC_REQ_FORMAT = "Content-Length: {json_string_len}\r\n\r\n{json_string}"
JSON_RPC_RES_REGEX = "Content-Length: ([0-9]*)\r\n"
# TODO: add content-type


class MyEncoder(json.JSONEncoder):
    """
    Encodes an object in JSON
    """

    def default(self, o):
        return o.__dict__


class JsonRpcEndpoint(object):
    """
    Thread safe JSON RPC endpoint implementation. Responsible to recieve and send JSON RPC messages, as described in the
    protocol. More information can be found: https://www.jsonrpc.org/
    """

    def __init__(self, stdin, stdout):
        self.stdin = stdin
        self.stdout = stdout
        self.read_lock = threading.Lock()
        self.write_lock = threading.Lock()

    @staticmethod
    def __add_header(json_string):
        """
        Adds a header for the given json string

        :param str json_string: The string
        :return: the string with the header
        """
        return JSON_RPC_REQ_FORMAT.format(
            json_string_len=len(json_string), json_string=json_string
        )

    def send_request(self, message):
        """
        Sends the given message.

        :param dict message: The message to send.
        """
        json_string = json.dumps(message, cls=MyEncoder)
        # print("sending:", json_string)
        jsonrpc_req = self.__add_header(json_string)
        with self.write_lock:
            self.stdin.write(jsonrpc_req.encode())
            self.stdin.flush()

    def recv_response(self):
        """
        Recives a message.

         :return: a message
        """
        with self.read_lock:
            line = self.stdout.readline()
            if not line:
                return None
            # print(line)
            line = line.decode()
            # TODO: handle content type as well.
            match = re.match(JSON_RPC_RES_REGEX, line)
            if match is None or not match.groups():
                raise RuntimeError("Bad header: " + line)
            size = int(match.groups()[0])
            line = self.stdout.readline()
            if not line:
                return None
            line = line.decode()
            # if line != "\r\n":
            #     raise RuntimeError("Bad header: missing newline")
            jsonrpc_res = self.stdout.read(size + 2)
            return json.loads(jsonrpc_res)
