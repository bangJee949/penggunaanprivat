
let uploadedFiles = [];
let userApiKey = localStorage.getItem("geminiApiKey") || "";
let resultData = [];

document.addEventListener("DOMContentLoaded", () => {
    const apiKeyInput = document.getElementById("apiKeyInput");
    const saveApiKey = document.getElementById("saveApiKey");
    const apiKeyStatus = document.getElementById("apiKeyStatus");
    const fileInput = document.getElementById("fileInput");
    const uploadArea = document.getElementById("uploadArea");
    const generateButton = document.getElementById("generateButton");
    const exportButton = document.getElementById("exportCSV");
    const previewArea = document.getElementById("previewArea");
    const results = document.getElementById("results");
    const toast = document.getElementById("toast");

    if (userApiKey) {
        apiKeyInput.value = userApiKey;
        apiKeyStatus.textContent = "✅ API Key ditemukan.";
        generateButton.disabled = false;
    }

    saveApiKey.addEventListener("click", () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            userApiKey = key;
            localStorage.setItem("geminiApiKey", key);
            apiKeyStatus.textContent = "✅ API Key disimpan.";
            generateButton.disabled = false;
        } else {
            apiKeyStatus.textContent = "❌ API Key tidak valid.";
        }
    });

    uploadArea.addEventListener("click", () => fileInput.click());
    uploadArea.addEventListener("dragover", e => {
        e.preventDefault();
        uploadArea.classList.add("drag-over");
    });
    uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("drag-over"));
    uploadArea.addEventListener("drop", e => {
        e.preventDefault();
        uploadArea.classList.remove("drag-over");
        handleFiles(Array.from(e.dataTransfer.files));
    });
    fileInput.addEventListener("change", e => handleFiles(Array.from(e.target.files)));

    function handleFiles(files) {
        const validFiles = files.filter(f => f.type.startsWith("image/") || f.type.startsWith("video/")).slice(0, 100);
        uploadedFiles = validFiles;
        previewArea.innerHTML = "";
        validFiles.forEach(file => {
            const url = URL.createObjectURL(file);
            const media = document.createElement(file.type.startsWith("video/") ? "video" : "img");
            media.src = url;
            if (file.type.startsWith("video/")) media.controls = true;
            media.className = "preview-media";
            previewArea.appendChild(media);
        });
        generateButton.disabled = validFiles.length === 0;
    }

    generateButton.addEventListener("click", async () => {
        if (!userApiKey) return alert("API Key belum diatur.");

        results.innerHTML = "⏳ Memproses metadata...";
        resultData = [];

        for (const file of uploadedFiles) {
            const base64 = await fileToBase64(file);
            const type = file.type.startsWith("video/") ? "video" : "image";

            const prompt = `Please analyze this ${type} content and return the metadata for Adobe Stock marketplace:

1. Title: clear, concise, 5-10 words, no punctuation.
2. Description: max 200 characters, informative.
3. Keywords: 49 comma-separated, most relevant.`;

            const body = {
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: file.type,
                                data: base64.split(",")[1]
                            }
                        }
                    ]
                }]
            };

            let title = "Untitled";
            let description = "Deskripsi belum tersedia.";
            let keywords = "default, keyword, untuk, konten, visual";

            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${userApiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

                title = extract("title", text) || title;
                description = extract("description", text) || description;
                keywords = extract("keywords", text) || keywords;

            } catch (err) {
                console.error("API Error:", err);
            }

            resultData.push({ filename: file.name, title, description, keywords });
        }

        displayResults(resultData);
        exportButton.disabled = resultData.length === 0;
    });

    exportButton.addEventListener("click", () => {
        let csv = "Filename,Title,Description,Keywords\n";
        resultData.forEach(d => {
            csv += `"${d.filename}","${d.title.replace(/"/g, '""')}","${d.description.replace(/"/g, '""')}","${d.keywords.replace(/"/g, '""')}"\n`;
        });
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "metadata.csv";
        a.click();
    });

    function extract(field, text) {
        const match = text.match(new RegExp(`${field}\s*[:：]\s*(.*?)\n`, "i"));
        return match ? match[1].trim() : "";
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = err => reject(err);
        });
    }

    function displayResults(dataArray) {
        results.innerHTML = "";
        dataArray.forEach(item => {
            const block = document.createElement("div");
            block.className = "tab-block";
            block.innerHTML = `
                <div class="tab-header"><h3>${item.filename}</h3></div>
                <div><strong>Title:</strong> <button class="copy-btn" onclick="copyText('${item.title}')">Copy</button><pre>${item.title}</pre></div>
                <div><strong>Description:</strong> <button class="copy-btn" onclick="copyText('${item.description}')">Copy</button><pre>${item.description}</pre></div>
                <div><strong>Keywords:</strong> <button class="copy-btn" onclick="copyText('${item.keywords}')">Copy</button><pre>${item.keywords}</pre></div>
            `;
            results.appendChild(block);
        });
    }

    window.copyText = function (txt) {
        navigator.clipboard.writeText(txt).then(() => {
            toast.textContent = "📋 Copied!";
            toast.classList.add("show");
            setTimeout(() => toast.classList.remove("show"), 2000);
        });
    };
});
