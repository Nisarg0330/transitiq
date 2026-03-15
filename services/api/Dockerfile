FROM python:3.12-slim

WORKDIR /app

# Copy everything first
COPY . .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8001

CMD ["uvicorn", "predictor:app", "--host", "0.0.0.0", "--port", "8001"]