#!/usr/bin/env python3

# Copyright (c) Meta Platforms, Inc. and affiliates.
# Copyright 2019 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

import argparse, sys
import sys
from http import HTTPStatus
from http.server import HTTPServer, SimpleHTTPRequestHandler
from os import path
from urllib.parse import urljoin

parser = argparse.ArgumentParser(
    epilog="Serves the dev output directory on the specified port."
)

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
        """
        We treat `/debugger-frontend` URL path as the root path of the file system.
        This reflects the URL path of Chrome DevTools when served from Metro.
        """
        if path.startswith("/debugger-frontend/"):
            path = path.split("/debugger-frontend")[1]
        return super().translate_path(path)

    def redirect_to_debugger_frontend(self):
        """
        When launched from Metro, Chrome DevTools is served at `/debugger-frontend`.
        This redirect allows relative URL paths to resolve as if it's served from Metro.
        """
        self.send_response(HTTPStatus.PERMANENT_REDIRECT)
        relative_path = self.path[1:]
        self.send_header("Location", urljoin("/debugger-frontend/", relative_path))
        self.end_headers()

    def do_GET(self):
        if not self.path.startswith("/debugger-frontend/"):
            return self.redirect_to_debugger_frontend()

        if REDIRECT_BASE_URL is None:
            return super().do_GET()

        self.redirect_static_path()

    def redirect_static_path():
        if not self.path.startswith("/debugger-frontend/static/"):
            return super().do_GET()

        print("Redirecting")
        self.send_response(HTTPStatus.TEMPORARY_REDIRECT)
        self.send_header("Location", urljoin(REDIRECT_BASE_URL, self.path))
        self.end_headers()


server_address = (
    "",  # Empty server_name for localhost
    PORT,
)

with HTTPServer(server_address, Handler) as httpd:
    output_dir = path.abspath("./out/Default/gen/front_end")
    print(f"Serving at http://localhost:{PORT}/debugger-frontend/rn_inspector.html")
    print(f"Serving files from {output_dir}")
    if REDIRECT_BASE_URL is not None:
        redirected_static_url = urljoin(REDIRECT_BASE_URL, "debugger-frontend/static/")
        print(
            f"Redirecting /debugger-frontend/static/ requests to {redirected_static_url}"
        )
    httpd.serve_forever()
