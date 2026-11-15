"""Send Python code to the Blender Lab MCP extension bridge (localhost:9876).

Usage: python tools/blender_bridge.py <file.py> [more.py ...]   (files are concatenated, in order)
       python tools/blender_bridge.py -c "code"
Code should set `result = {...}` to return data.
"""
import json, socket, sys

def run(code, host="localhost", port=9876, timeout=900):
    with socket.create_connection((host, port), timeout=timeout) as s:
        s.sendall(json.dumps({"type": "execute", "code": code, "strict_json": False}).encode() + b"\0")
        buf = b""
        while not buf.endswith(b"\0"):
            chunk = s.recv(65536)
            if not chunk:
                break
            buf += chunk
    return json.loads(buf.rstrip(b"\0"))

if __name__ == "__main__":
    if sys.argv[1] == "-c":
        code = sys.argv[2]
    else:
        code = "\n\n".join(open(f, encoding="utf-8").read() for f in sys.argv[1:])
    print(json.dumps(run(code), indent=2))
