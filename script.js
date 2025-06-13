
let storedTitles = [];

function switchTab(index) {
  document.querySelectorAll('.tab').forEach((tab, i) => {
    tab.classList.toggle('active', i === index);
    document.getElementById(`tab-${i}`).classList.toggle('hidden', i !== index);
  });
}

function testAPI() {
  const apiKey = document.getElementById("api-key").value.trim();
  if (apiKey) {
    alert("API Key berhasil ditambahkan! (dummy check)");
  } else {
    alert("Silakan tempelkan API Key Gemini Anda.");
  }
}

function generateTren() {
  const tema = document.getElementById("tema").value.toLowerCase().trim();
  const output = document.getElementById("hasil-list");
  const label = document.getElementById("tema-output");
  label.textContent = tema || "(kosong)";
  output.innerHTML = "";
  storedTitles = Array.from({length: 100}, (_, i) =>
    `${tema.charAt(0).toUpperCase() + tema.slice(1)} trending image #${i+1} (prediksi Juli-Sept 2025)`
  );
  storedTitles.forEach(j => {
    const li = document.createElement("li");
    li.textContent = j;
    output.appendChild(li);
  });
}

function generateBatchPrompt() {
  const output = document.getElementById("prompt-output");
  if (!storedTitles.length) {
    output.textContent = "Harap buat prediksi gambar terlebih dahulu pada Tab 1.";
    return;
  }

  const prompts = storedTitles.map(title => 
    `Text-to-Image Prompt: A high-quality visual of "${title}", realistic lighting, dynamic composition, trending Q3 2025 visual design.`
  );

  output.textContent = prompts.join('\n\n');
}
