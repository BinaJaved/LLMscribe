# Run the Python service

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install torch transformers fastapi uvicorn

cd polycoder_service
uvicorn polycoder_service:app --reload --host 0.0.0.0 --port 8001
