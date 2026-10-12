from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")
# 關鍵：html=True 讓它自動找 index.html
app.mount("/", StaticFiles(directory="site", html=True), name="site")