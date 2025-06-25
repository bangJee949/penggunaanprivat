import os
import paramiko
import mimetypes
import base64

def upload_to_sftp(filepath, login):
    try:
        transport = paramiko.Transport((login["host"], login["port"]))
        transport.connect(username=login["username"], password=login["password"])
        sftp = paramiko.SFTPClient.from_transport(transport)
        sftp.put(filepath, os.path.basename(filepath))
        sftp.close()
        transport.close()
        return True, "Upload successful via SFTP."
    except Exception as e:
        return False, str(e)

def generate_metadata_with_gemini(filepath, api_key):
    import requests
    mime_type, _ = mimetypes.guess_type(filepath)
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    prompt = f"Generate title, description, and keywords for stock asset based on file name: {os.path.basename(filepath)}"
    data = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    try:
        response = requests.post("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
                                 headers=headers, json=data)
        resp_data = response.json()
        text = resp_data['candidates'][0]['content']['parts'][0]['text']
        lines = text.split("\n")
        title = lines[0].replace("Title:", "").strip()
        description = lines[1].replace("Description:", "").strip()
        keywords = [k.strip() for k in lines[2].replace("Keywords:", "").split(",")]
        return title, description, keywords
    except Exception as e:
        return "Auto Title Failed", "Auto Description Failed", ["auto", "keywords", "failed"]
