function generateMetadata(fileName, tags = []) {
    const baseName = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
    const title = baseName.slice(0, 70);
    const description = `Konten berjudul \"${baseName}\" cocok untuk berbagai kebutuhan kreatif.`;
    const keywords = [...new Set(tags.concat(baseName.toLowerCase().split(" ")))]
        .filter(k => k.length > 2)
        .slice(0, 50);
    return { title, description, keywords };
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    const toast = document.getElementById("toast");

    if (userApiKey && apiKeyInput) {
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
    uploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadArea.classList.add("drag-over");
    });
    uploadArea.addEventListener("dragleave", () => {
        uploadArea.classList.remove("drag-over");
    });
    uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("drag-over");
        handleFiles(Array.from(e.dataTransfer.files));
    });

    fileInput.addEventListener("change", e => handleFiles(Array.from(e.target.files)));

    function handleFiles(files) {
        const selected = files.slice(0, 100).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
        uploadedFiles = selected;
        previewArea.innerHTML = "";
        selected.forEach(file => {
            const url = URL.createObjectURL(file);
            const media = document.createElement(file.type.startsWith("video/") ? "video" : "img");
            media.src = url;
            if (file.type.startsWith("video/")) media.controls = true;
            media.className = "preview-media";
            previewArea.appendChild(media);
        });
        generateButton.disabled = selected.length === 0;
    }
        generateButton.disabled = uploadedFiles.length === 0;
    });

    generateButton.addEventListener("click", async () => {
        if (!userApiKey) return alert("API Key not set.");

        results.innerHTML = "Generating metadata...";
        const output = [];

        for (const [i, file] of uploadedFiles.entries()) {
            const base64 = await fileToBase64(file);
            const type = file.type.startsWith("video/") ? "video" : "image";

            const prompt = `Act as a professional Adobe Stock content contributor. Analyze this ${type} and return metadata strictly following Adobe Stock Contributor Guidelines (https://helpx.adobe.com/stock/contributor/help/titles-and-keyword.html):\n\n1. Title: Descriptive, clear, no punctuation, avoid brand/model, use 5-8 trending, relevant words.\n2. Description: Max 200 characters, keyword-rich, editorial/creative use allowed.\n3. Keywords: Exactly 49, comma-separated, ordered from most to least relevant, no trademark or brand words.`;

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

            let resultText = "";
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${userApiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body)
                    });
                const data = await res.json();
                resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } catch (err) {
                console.error("Metadata fetch error:", err);
            }

            let title = extract("title", resultText);
            let description = extract("description", resultText);
            let keywords = extract("keywords", resultText).split(/[,
]/).map(k => k.trim()).filter(k => k.length > 0).slice(0, 49).join(", ");

            const fallback = generateMetadata(file.name);
            if (!title || title === "N/A") title = fallback.title;
            if (!description || description === "N/A") description = fallback.description;
            if (!keywords || keywords === "N/A") keywords = fallback.keywords.join(", ");

            output.push({
                filename: file.name,
                previewUrl: URL.createObjectURL(file),
                type: file.type,
                title,
                description,
                keywords
            });

            await delay(500); // jeda antar permintaan API
        }

        displayResults(output);
    });

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = err => reject(err);
        });
    }

    function extract(field, text) {
        const match = text.match(new RegExp(`${field}\\s*[:：]\\s*(.*?)\\n`, "i"));
        return match ? match[1].trim() : "";
    }

    function displayResults(dataArray) {
        results.innerHTML = "";
        dataArray.forEach(item => {
            const block = document.createElement("div");
            block.className = "tab-block";

            const media = document.createElement(item.type.startsWith("video/") ? "video" : "img");
            media.src = item.previewUrl;
            if (item.type.startsWith("video/")) media.controls = true;
            media.className = "preview-media";
            block.appendChild(media);

            block.innerHTML += `
                <div class="tab-header"><h3>${item.filename}</h3></div>
                <div><strong>Title:</strong> <button class="copy-btn" onclick="copyText('${item.title}')">Copy</button><pre>${item.title}</pre></div>`
                <div><strong>Description:</strong> <button class="copy-btn" onclick="copyText('${item.description}')">Copy</button><pre>${item.description}</pre></div>
                <div><strong>Keywords:</strong> <button class="copy-btn" onclick="copyText('${item.keywords}')">Copy</button><pre>${item.keywords}</pre></div>
            `;
            results.appendChild(block);
        });
    }

    window.copyText = function(txt) {
        navigator.clipboard.writeText(txt).then(() => {
            toast.textContent = "Copied!";
            toast.classList.add("show");
            setTimeout(() => toast.classList.remove("show"), 2000);
        });
    };
});
