FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV (headless)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (layer-cache friendly)
COPY grading-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy service entrypoint
COPY grading-service/main.py ./main.py

# Copy ML modules from the backend package into ./ml/
# Build context must be the repo root (see docker-compose.yml)
COPY backend/api/ml/ ./ml/

# Ensure ml/ is importable as a package (add __init__.py if missing)
RUN test -f ./ml/__init__.py || touch ./ml/__init__.py

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
