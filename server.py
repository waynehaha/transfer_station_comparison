#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import mimetypes

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / 'data'
DATA_FILE = DATA_DIR / 'providers.json'
PORT = 4173
HOST = '127.0.0.1'

DEFAULT_PROVIDERS = [
    {
        "id": "default-su8-max",
        "name": "su8-max",
        "rechargeCny": 12,
        "usdCredit": 100,
        "officialInputPrice": 5,
        "officialOutputPrice": 30,
        "officialCachePrice": 0.5,
        "multiplier": 2,
    },
    {
        "id": "default-woyao-03-pro",
        "name": "woyao-0.3 Pro",
        "rechargeCny": 100,
        "usdCredit": 100,
        "officialInputPrice": 5,
        "officialOutputPrice": 30,
        "officialCachePrice": 0.5,
        "multiplier": 1,
    },
    {
        "id": "default-tok-pro-04",
        "name": "TOK-Pro-0.4",
        "rechargeCny": 100,
        "usdCredit": 100,
        "officialInputPrice": 5,
        "officialOutputPrice": 30,
        "officialCachePrice": 0.5,
        "multiplier": 1,
    },
]


def ensure_data_file():
    DATA_DIR.mkdir(exist_ok=True)
    if not DATA_FILE.exists():
        write_providers(DEFAULT_PROVIDERS)


def read_providers():
    ensure_data_file()
    try:
        data = json.loads(DATA_FILE.read_text(encoding='utf-8'))
        providers = data.get('providers', data if isinstance(data, list) else [])
        if not isinstance(providers, list):
            return []
        return providers
    except Exception:
        return []


def write_providers(providers):
    DATA_DIR.mkdir(exist_ok=True)
    payload = {
        "providers": providers,
        "note": "中转站价格对比工具的数据文件。这个文件保存在项目里，换浏览器也不会丢。"
    }
    tmp_file = DATA_FILE.with_suffix('.json.tmp')
    tmp_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp_file.replace(DATA_FILE)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split('?')[0] == '/api/providers':
            self.send_json(200, {"providers": read_providers()})
            return
        return super().do_GET()

    def do_POST(self):
        if self.path.split('?')[0] != '/api/providers':
            self.send_json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            raw = self.rfile.read(length)
            data = json.loads(raw.decode('utf-8'))
            providers = data.get('providers')
            if not isinstance(providers, list):
                raise ValueError('providers must be a list')
            write_providers(providers)
            self.send_json(200, {"ok": True, "count": len(providers)})
        except Exception as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})


if __name__ == '__main__':
    ensure_data_file()
    mimetypes.add_type('text/javascript; charset=utf-8', '.js')
    mimetypes.add_type('text/css; charset=utf-8', '.css')
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f'中转站价格对比服务已启动：http://{HOST}:{PORT}/index.html')
    server.serve_forever()
