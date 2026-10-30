# Enterprise Ingestion Firewall

A FastAPI service and browser-based interface for classifying incoming support
messages by intent, risk, and priority. The frontend is served by the backend,
so the API and UI run together on one local address.

## Run locally

From the project root in PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
if (-not (Test-Path .\backend\.env)) { Copy-Item .\backend\.env.example .\backend\.env }
```

Edit `backend\.env` and set `GROQ_API_KEY` to your own Groq API key. Then start
the app:

```powershell
Set-Location .\backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Open <http://127.0.0.1:8000>. The API health check is at `/health`, and
interactive API documentation is at `/docs`.

Conversation history is stored in server memory only. It is not written to a
database and is cleared whenever the server process restarts.

## Run tests

From the project root:

```powershell
Set-Location .\backend
..\.venv\Scripts\python.exe -m pytest .\tests
```
