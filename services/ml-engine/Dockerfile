FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY services/ml-engine/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy ML engine files
COPY services/ml-engine/ ./

EXPOSE 8001

CMD ["uvicorn", "predictor:app", "--host", "0.0.0.0", "--port", "8001"]
