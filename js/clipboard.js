document.querySelectorAll(".copy-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    navigator.clipboard.writeText(target.innerText);

    btn.innerHTML = "✓ Copied";
    setTimeout(() => {
      btn.innerHTML = '<i class="fa fa-copy"></i> Copy';
    }, 1500);
  });
});