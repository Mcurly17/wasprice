# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class WasPrice(gl.Contract):
    next_pledge: u256

    def __init__(self):
        self.next_pledge = u256(0)

    @gl.public.view
    def get_stats(self) -> str:
        return '{"pledges": ' + str(int(self.next_pledge)) + "}"
