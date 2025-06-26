
async function generateMetadataAI(base64Image, fileName, apiKey) {
    const prompt = `
Anda adalah asisten metadata untuk Adobe Stock. Berdasarkan gambar yang diberikan, buat:
1. Judul (maks 70 karakter, deskriptif, relevan)
2. Deskripsi (2 kalimat, jelas, sesuai konten, maks 200 karakter)
3. 25-50 Keyword relevan (dalam bahasa Inggris, dipisahkan koma)

Gunakan pedoman resmi Adobe Stock: https://helpx.adobe.com/id_id/stock/contributor/help/titles-and-keyword.html
Jangan sebutkan 'gambar ini', 'foto ini', dll. Langsung sebut objeknya.

Output dalam format JSON seperti ini:
{
  "title": "...",
  "description": "...",
  "keywords": ["...", "..."]
}`;

    const body = {
        contents: [{
            parts: [
                { text: prompt },
                { inlineData: { mimeType: "image/jpeg", data: base64Image } }
            ]
        }]
    };

    try {
        const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=" + apiKey, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}") + 1;
        const metadata = JSON.parse(text.slice(jsonStart, jsonEnd));
        return {
            title: metadata.title || "Untitled",
            description: metadata.description || "No description.",
            keywords: metadata.keywords || []
        };
    } catch (err) {
        console.error("Metadata generation failed:", err);
        const baseName = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        return {
            title: baseName.slice(0, 70),
            description: "Stock asset with relevant visual content.",
            keywords: baseName.toLowerCase().split(" ").filter(k => k.length > 2).slice(0, 20)
        };
    }
}

let uploadedFiles = [];
let userApiKey = localStorage.getItem("geminiApiKey") || "";

document.addEventListener("DOMContentLoaded", () => {
    const apiKeyInput = document.getElementById("apiKeyInput");
    const saveApiKey = document.getElementById("saveApiKey");
    const apiKeyStatus = document.getElementById("apiKeyStatus");
    const fileInput = document.getElementById("fileInput");
    const uploadArea = document.getElementById("uploadArea");
    const generateButton = document.getElementById("generateButton");
    const previewArea = document.getElementById("previewArea");
    const results = document.getElementById("results");

    if (userApiKey) {
        apiKeyInput.value = userApiKey;
        apiKeyStatus.textContent = "API Key loaded.";
        generateButton.disabled = false;
    }

    saveApiKey.addEventListener("click", () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            userApiKey = key;
            localStorage.setItem("geminiApiKey", key);
            apiKeyStatus.textContent = "API Key saved.";
            generateButton.disabled = false;
        } else {
            apiKeyStatus.textContent = "Please enter a valid API key.";
        }
    });

    uploadArea.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", e => {
        const files = Array.from(e.target.files).slice(0, 100);
        uploadedFiles = files.filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
        previewArea.innerHTML = "";
        uploadedFiles.forEach(file => {
            const url = URL.createObjectURL(file);
            const media = document.createElement(file.type.startsWith("video/") ? "video" : "img");
            media.src = url;
            if (file.type.startsWith("video/")) media.controls = true;
            media.className = "preview-media";
            previewArea.appendChild(media);
        });
        generateButton.disabled = uploadedFiles.length === 0;
    });

    generateButton.addEventListener("click", async () => {
        if (!userApiKey) return alert("API Key not set.");

        results.innerHTML = "Generating metadata...";
        const output = [];

        for (const file of uploadedFiles) {
            const base64 = await fileToBase64(file);
            const metadata = await generateMetadataAI(base64, file.name, userApiKey);
            output.push({
                name: file.name,
                ...metadata
            });

            await delay(1000); // Delay to avoid rate limit / overload
        }

        results.innerHTML = "<h3>Generated Metadata</h3><pre>" + JSON.stringify(output, null, 2) + "</pre>";
    });
});

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
