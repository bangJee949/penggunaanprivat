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
        uploadedFiles = files.filter(f => f.type.startsWith("image/"));
        previewArea.innerHTML = "";
        uploadedFiles.forEach(file => {
            const url = URL.createObjectURL(file);
            const media = document.createElement("img");
            media.src = url;
            media.className = "preview-media";
            previewArea.appendChild(media);
        });
        generateButton.disabled = uploadedFiles.length === 0;
    });

    generateButton.addEventListener("click", async () => {
        if (!userApiKey) return alert("API Key not set.");

        results.innerHTML = "Generating metadata...";
        const output = [];

        for (const file of uploadedFiles.slice(0, 3)) {
            const base64 = await fileToBase64(file);
            const blob = await (await fetch(base64)).blob();

            const captionData = await callDeepAI("image-captioning", blob);
            const tagData = await callDeepAI("densecap", blob);

            let rawTitle = captionData?.output?.trim() || "Untitled Stock Video";
            rawTitle = rawTitle.replace(/[.,:!?]/g, "").toLowerCase();

            const titleWords = rawTitle.split(" ").slice(0, 10);
            const title = titleWords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

            const description = `Stock footage menampilkan ${rawTitle}, cocok untuk penggunaan komersial, editorial, dan proyek kreatif lainnya.`;

            const tags = tagData?.output?.captions?.map(c => c.caption.split(" "))
                .flat()
                .map(k => k.toLowerCase().replace(/[^\w]/g, ""))
                .filter(k => k.length > 2);

            const keywordSet = new Set([...tags, ...titleWords]);
            const keywords = Array.from(keywordSet).filter(Boolean).slice(0, 45);

            const text = `
Title: ${title}
Description: ${description}
Keywords: ${keywords.join(", ")}
`;

            output.push({
                filename: file.name,
                previewUrl: URL.createObjectURL(file),
                type: file.type,
                text
            });
        }

        displayResults(output);
    });

    async function callDeepAI(endpoint, blob) {
        const formData = new FormData();
        formData.append("image", blob);

        try {
            const res = await fetch(`https://api.deepai.org/api/${endpoint}`, {
                method: "POST",
                headers: {
                    "api-key": userApiKey
                },
                body: formData
            });
            return await res.json();
        } catch (err) {
            console.error(`DeepAI ${endpoint} error:`, err);
            return null;
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

    function extract(field, text) {
        const match = text.match(new RegExp(`${field}\\s*[:：]\\s*(.*?)\\n`, "i"));
        return match ? match[1].replace(/^\*+|\*+$/g, "").trim() : "N/A";
    }

    function clean(text) {
        return text.replace(/^\*+|\*+$/g, "").trim();
    }

    function displayResults(dataArray) {
        results.innerHTML = "";
        dataArray.forEach(item => {
            const block = document.createElement("div");
            block.className = "tab-block";

            const media = document.createElement("img");
            media.src = item.previewUrl;
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
