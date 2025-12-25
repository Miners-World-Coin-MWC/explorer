const toggle = document.getElementById('themeToggle')

			// Auto-detect system theme
			if (window.matchMedia('(prefers-color-scheme: light)').matches) {
				document.body.classList.add('light')
			}

			toggle.addEventListener('click', () => {
				document.body.classList.toggle('light')
				localStorage.setItem(
				'mwc-theme',
				document.body.classList.contains('light') ? 'light' : 'dark'
				)
			})

			// Persist choice
			const saved = localStorage.getItem('mwc-theme')
			if (saved === 'light') {
				document.body.classList.add('light')
			}