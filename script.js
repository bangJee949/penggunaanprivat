
const temaData = {
  "alam": Array.from({length: 100}, (_, i) => `Gambar trending #${i+1} - Tema Alam (Prediksi Juli-Sept 2025)`)
};

function switchTab(index) {
  document.querySelectorAll('.tab').forEach((tab, i) => {
    tab.classList.toggle('active', i === index);
    document.getElementById(`tab-${i}`).classList.toggle('hidden', i !== index);
  });
}

function generateTren() {
  const tema = document.getElementById("tema").value.toLowerCase().trim();
  const output = document.getElementById("hasil-list");
  const label = document.getElementById("tema-output");
  label.textContent = tema || "(kosong)";
  output.innerHTML = "";
  const list = temaData[tema] || Array.from({length: 100}, (_, i) => `Gambar trending prediksi #${i+1} untuk tema '${tema}'`);
  list.forEach(j => {
    const li = document.createElement("li");
    li.textContent = j;
    output.appendChild(li);
  });
}

function generatePrompt() {
  const judul = document.getElementById("judul").value.trim();
  const output = document.getElementById("prompt-output");
  if (!judul) {
    output.textContent = "Masukkan judul atau konsep gambar.";
    return;
  }
  output.textContent = `Text-to-Image Prompt:
A high-resolution image of "${judul}", realistic lighting, dynamic composition, artistic detail, trending visual style (2025 Q3).`;
}
