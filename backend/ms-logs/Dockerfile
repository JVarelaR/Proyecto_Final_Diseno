FROM python:3.12-slim

WORKDIR /app

COPY requirements-common.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY shared ./shared
COPY alembic.ini ./alembic.ini
COPY migrations ./migrations
COPY ms-logs/app ./app

ENV PYTHONPATH=/app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
