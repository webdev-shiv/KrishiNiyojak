import json
import urllib.request

token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwicm9sZXMiOlsiQ0hDX01BTkFHRVIiLCJNQU5BR0VSIl0sImlhdCI6MTc5MjI3NzQzOCwiZXhwIjoxNzkyMjc4MzM4fQ.MjB-xvY64iyntPTgMdrjMYbu5TCXi_xbvFcuNOD092w'

for ep in ['stats', 'today-schedule', 'recent-requests', 'map-data']:
    url = f'http://127.0.0.1:8000/api/v1/chc/dashboard/{ep}'
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"[{ep}] SUCCESS: {data if isinstance(data, list) else list(data.keys())}")
    except urllib.error.HTTPError as e:
        print(f"[{ep}] HTTP ERROR {e.code}: {e.read().decode()}")
    except Exception as e:
        print(f"[{ep}] EXCEPTION: {e}")
