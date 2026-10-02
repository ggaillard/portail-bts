FROM python:3.12-slim

# Un utilisateur sans privilèges : le conteneur ne tourne pas en root
RUN useradd --create-home appli
WORKDIR /appli

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py prompt.txt ./
COPY static ./static

USER appli
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
