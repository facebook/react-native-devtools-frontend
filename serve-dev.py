#!/usr/bin/env python3

import argparse, sys
import sys
from http import HTTPStatus
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urljoin

parser = argparse.ArgumentParser()

parser.add_argument("port", type=int, help="Port number, e.g. 8000")
parser.add_argument(
    "-r",
    "--redirect_static_base_url",
    help="The destination URl for /static/* requests, e.g. http://localhost:8081/",
)

args = parser.parse_args()

PORT = args.port
REDIRECT_BASE_URL = args.redirect_static_base_url


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="out/Default/gen/front_end", **kwargs)

    def translate_path(self, path):
        if path.startswith("/debugger-frontend/"):
            path = path.split("/debugger-frontend")[1]
        return super().translate_path(path)

    def redirect_to_debugger_frontend(self):
        self.send_response(HTTPStatus.PERMANENT_REDIRECT)
        relative_path = self.path[1:]
        self.send_header("Location", urljoin("/debugger-frontend/", relative_path))
        self.end_headers()

    def do_GET(self):
        if not self.path.startswith("/debugger-frontend/"):
            return self.redirect_to_debugger_frontend()

        if REDIRECT_BASE_URL is None:
            return super().do_GET()

        if not self.path.startswith("/debugger-frontend/static/"):
            return super().do_GET()

        self.send_response(HTTPStatus.TEMPORARY_REDIRECT)
        self.send_header("Location", urljoin(REDIRECT_BASE_URL, self.path))
        self.end_headers()


server_address = (
    "",  # server_name
    PORT,
)

with HTTPServer(server_address, Handler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    httpd.serve_forever()
