document.querySelectorAll(".tab-button").forEach(button => {
			button.addEventListener("click", () => {
				const tab = button.dataset.tab;

				// Deactivate all buttons
				document.querySelectorAll(".tab-button").forEach(b =>
				b.classList.remove("active")
				);

				// Hide all contents
				document.querySelectorAll(".tab-content").forEach(c =>
				c.classList.remove("active")
				);

				// Activate selected
				button.classList.add("active");
				document.getElementById("tab-" + tab).classList.add("active");
			});
			});