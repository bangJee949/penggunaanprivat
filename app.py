from flask import Flask, request, render_template, jsonify
from uploader import upload_to_sftp, generate_metadata_with_gemini
import os

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/upload", methods=["POST"])
def upload():
    file = request.files['file']
    platform = request.form['platform']
    protocol = request.form['protocol']
    host = request.form['host']
    port = int(request.form['port'])
    username = request.form['username']
    password = request.form['password']
    gemini_api_key = request.form['gemini_key']

    save_path = os.path.join("uploads", file.filename)
    os.makedirs("uploads", exist_ok=True)
    file.save(save_path)

    # Generate metadata
    title, description, keywords = generate_metadata_with_gemini(save_path, gemini_api_key)
    metadata = {
        "title": title,
        "description": description,
        "keywords": keywords
    }

    login = {
        "host": host,
        "port": port,
        "username": username,
        "password": password,
        "protocol": protocol
    }

    success, message = upload_to_sftp(save_path, login)
    return jsonify({
        "success": success,
        "message": message,
        "metadata": metadata
    })

if __name__ == "__main__":
    app.run(debug=True)
