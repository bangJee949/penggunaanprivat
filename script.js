
function showTab(index) {
  document.querySelectorAll('.tab').forEach((tab, i) => {
    tab.classList.toggle('active', i === index);
    document.getElementById(`tab-${i}`).classList.toggle('hidden', i !== index);
  });
}
