function generateMetadata(fileName, tags = []) {
    const baseName = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
    const title = baseName.slice(0, 70);

    const description = `Foto atau video dengan judul "${baseName}" yang menggambarkan konten visual dengan jelas. Cocok untuk digunakan dalam berbagai proyek kreatif yang memerlukan aset visual berkualitas.`;

    const keywords = [...new Set(tags.concat(baseName.toLowerCase().split(" ")))]
        .filter(k => k.length > 2)
        .slice(0, 50);

    return { title, description, keywords };
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

    generateButton.addEventListener("click", () => {
        if (!userApiKey) return alert("API Key not set.");
        if (uploadedFiles.length === 0) return;

        results.innerHTML = "";
        processQueue(uploadedFiles);
    });

    async function processQueue(files) {
        for (const [index, file] of files.entries()) {
            const notice = document.createElement("div");
            notice.textContent = `⏳ Memproses file ${index + 1} dari ${files.length}...`;
            results.appendChild(notice);

            let result;
            let retries = 0;
            const maxRetries = 3;

            do {
                result = await generateMetadataFromFile(file);
                const title = clean(extract("title", result.text));
                const desc = clean(extract("description", result.text));
                const keywords = clean(extract("keywords", result.text));

                const isValid = title && title !== "N/A" &&
                                desc && desc !== "N/A" &&
                                keywords && keywords !== "N/A";

                if (isValid) {
                    result.text = `Title: ${title}\nDescription: ${desc}\nKeywords: ${keywords}`;
                    break;
                }

                retries++;
                console.warn(`🔁 Retry ${retries} untuk file: ${file.name}`);
                await sleep(3000);
            } while (retries < maxRetries);

            displayResults([result]);
            await sleep(2500);
        }

        const done = document.createElement("div");
        done.innerHTML = "<strong>✅ Semua file selesai diproses.</strong>";
        results.appendChild(done);
    }

    async function generateMetadataFromFile(file) {
        try {
            const base64 = await fileToBase64(file);
            const type = file.type.startsWith("video/") ? "video" : "image";

            const prompt = `Please analyze this ${type} content and return the metadata for Adobe Stock marketplace:

1. Title: extremely relevant, clear, concise, 5-10 words only, no punctuation, prioritize trending accurate phrases.
2. Description: no more than 200 characters, very informative, clear and keyword-rich.
3. Keywords: return exactly 49 highly relevant, popular and trending one-word keywords only, comma-separated, no duplicates. First 10 keywords must match top downloaded contributor tags. No phrases.`;

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

            let text = "";

            for (let attempt = 0; attempt < 3; attempt++) {
                await sleep(1000 * (attempt + 1));
                try {
                    const res = await fetchWithTimeout(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${userApiKey}`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(body)
                        }
                    );

                    const data = await res.json();
                    if (data.error) {
                        console.error("Gemini API Error:", data.error.message);
                        continue;
                    }

                    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                    text = raw;
                    if (text && text.length > 30) break;

                } catch (err) {
                    console.error("Fetch error:", err.message);
                }
            }

            if (!text) {
                text = "Gagal menghasilkan metadata. Periksa API key atau coba lagi nanti.";
            }

            return {
                filename: file.name,
                previewUrl: URL.createObjectURL(file),
                type: file.type,
                text: text
            };
        } catch (err) {
            console.error("Fatal error on file:", file.name, err);
            return {
                filename: file.name,
                previewUrl: URL.createObjectURL(file),
                type: file.type,
                text: "❌ Gagal total saat memproses file ini."
            };
        }
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = err => reject(err);
        });
    }

    function fetchWithTimeout(url, options, timeout = 15000) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout")), timeout))
        ]);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function extract(field, text) {
        const regex = new RegExp(`${field}\s*[:：]?\s*(.+?)(\n|$)`, "i");
        const match = text.match(regex);
        return match ? match[1].replace(/^\*+|\*+$/g, "").trim() : "N/A";
    }

    function clean(text) {
        return text.replace(/^\*+|\*+$/g, "").trim();
    }

    function displayResults(dataArray) {
        dataArray.forEach(item => {
            const block = document.createElement("div");
            block.className = "tab-block";

            const media = document.createElement(item.type.startsWith("video/") ? "video" : "img");
            media.src = item.previewUrl;
            if (item.type.startsWith("video/")) media.controls = true;
            media.className = "preview-media";
            block.appendChild(media);

            const title = clean(extract("title", item.text));
            const desc = clean(extract("description", item.text));
            const keywords = clean(extract("keywords", item.text));

            block.innerHTML += `
                <div class="tab-header"><h3>${item.filename}</h3></div>
                <div><strong>Title:</strong> <button class="copy-btn" onclick="copyText(\`${title}\`)">Copy</button><pre>${title}</pre></div>
                <div><strong>Description:</strong> <button class="copy-btn" onclick="copyText(\`${desc}\`)">Copy</button><pre>${desc}</pre></div>
                <div><strong>Keywords:</strong> <button class="copy-btn" onclick="copyText(\`${keywords}\`)">Copy</button><pre>${keywords}</pre></div>
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
