FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir requests PyJWT

COPY app.py .
COPY video_lab/ video_lab/

RUN mkdir -p data/assets

EXPOSE 8000

CMD ["python3", "app.py"]
