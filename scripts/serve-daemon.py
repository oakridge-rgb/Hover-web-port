#!/usr/bin/env python3
"""Double-fork daemon: serve a folder on a port, survive parent exit."""
import os, sys, socket, subprocess, time

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8902
ROOT = sys.argv[2] if len(sys.argv) > 2 else "/home/z/my-project/download/v8.2-deploy"

def alive(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0

if alive(PORT):
    print(f"port {PORT} already serving")
    sys.exit(0)

pid = os.fork()
if pid == 0:
    os.setsid()
    pid2 = os.fork()
    if pid2 == 0:
        os.chdir(ROOT)
        devnull = os.open(os.devnull, os.O_RDWR)
        os.dup2(devnull, 0); os.dup2(devnull, 1); os.dup2(devnull, 2)
        os.execvp("python3", ["python3", "-m", "http.server", str(PORT)])
    os._exit(0)
os.waitpid(pid, 0)

for _ in range(20):
    if alive(PORT):
        print(f"serving {ROOT} on {PORT}")
        sys.exit(0)
    time.sleep(0.25)
print("failed to start")
sys.exit(1)
