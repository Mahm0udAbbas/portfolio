"""Send Python code to the Blender Lab MCP extension bridge (localhost:9876).

Usage: python bl.py <file.py>   or   python bl.py -c "code"
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
    code = sys.argv[2] if sys.argv[1] == "-c" else open(sys.argv[1], encoding="utf-8").read()
    print(json.dumps(run(code), indent=2))
