document.addEventListener("DOMContentLoaded", () => {

    // =======================================
    // Network Configuration
    // =======================================
    const NETWORKS = {
        mainnet: {
            name: "Mainnet",
            endpoint: "https://api.minersworld.org/peers"
        },
        testnet: {
            name: "Testnet",
            endpoint: "https://api.minersworld.org/testnet/peers"
        }
    };

    const isTestnet =
        location.search.includes("testnet") ||
        location.pathname.includes("testnet");

    const NETWORK = isTestnet ? "testnet" : "mainnet";

    // =======================================
    // Map Setup
    // =======================================
    const map = L.map("node-map").setView([20, 0], 2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© MinersWorldCoin contributors",
        maxZoom: 18
    }).addTo(map);

    const markers = L.markerClusterGroup();

    const customIcon = L.icon({
        iconUrl: "img/favicon-32.png",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });

    // =======================================
    // State
    // =======================================
    const countryCounts = {};
    const versions = new Set();
    const nodes = [];
    const uniqueIPs = new Set();

    // =======================================
    // Normalize IP (IPv4 / IPv6 safe)
    // =======================================
    function normalizeIP(addr) {
        if (!addr) return "";

        // IPv6 [addr]:port
        if (addr.startsWith("[") && addr.includes("]")) {
            return addr.slice(1, addr.indexOf("]"));
        }

        // IPv4:port
        if (addr.includes(":")) {
            const last = addr.lastIndexOf(":");
            const port = addr.substring(last + 1);
            if (!isNaN(parseInt(port))) {
                return addr.substring(0, last);
            }
        }

        return addr;
    }

    // =======================================
    // Fetch Peers
    // =======================================
    fetch(NETWORKS[NETWORK].endpoint)
        .then(res => res.json())
        .then(data => {
            const peers = data.result || [];

            peers.forEach(peer => {
                const ip = normalizeIP(peer.addr);
                if (!ip || uniqueIPs.has(ip)) return;

                uniqueIPs.add(ip);

                fetch(`https://get.geojs.io/v1/ip/geo/${ip}.json`)
                    .then(r => r.json())
                    .then(loc => {
                        const country = loc.country || "Unknown";
                        const city = loc.city || "";
                        const version = peer.subver || "Unknown";

                        countryCounts[country] = (countryCounts[country] || 0) + 1;
                        versions.add(version);

                        const marker = L.marker(
                            [loc.latitude, loc.longitude],
                            { icon: customIcon }
                        ).bindPopup(
                            `<b>${ip}</b><br>${city}${city ? ", " : ""}${country}`
                        );

                        marker.meta = { ip, country, version };
                        markers.addLayer(marker);

                        nodes.push({ marker, meta: marker.meta });

                        updateStats();
                        updateFilters();
                        renderTable();
                    })
                    .catch(err => {
                        console.error("GeoJS error:", err);
                    });
            });

            map.addLayer(markers);
        })
        .catch(err => {
            console.error("Peer fetch error:", err);
        });

    // =======================================
    // Stats
    // =======================================
    function updateStats() {
        document.getElementById("stat-nodes").textContent = nodes.length;
        document.getElementById("stat-countries").textContent = Object.keys(countryCounts).length;
        document.getElementById("stat-versions").textContent = versions.size;
        document.getElementById("stat-time").textContent = new Date().toLocaleTimeString();
    }

    // =======================================
    // Filters
    // =======================================
    function updateFilters() {
        const countryContainer = document.getElementById("country-checkboxes");
        const versionSelect = document.getElementById("filter-version");

        countryContainer.innerHTML = Object.keys(countryCounts)
            .sort()
            .map(c => `
                <div>
                    <input type="checkbox" class="country-filter" value="${c}" checked> ${c}
                </div>
            `).join("");

        versionSelect.innerHTML =
            `<option value="">All Versions</option>` +
            Array.from(versions)
                .sort()
                .map(v => `<option value="${v}">${v}</option>`)
                .join("");

        countryContainer.querySelectorAll("input").forEach(input => {
            input.addEventListener("change", applyFilters);
        });

        versionSelect.addEventListener("change", applyFilters);
        document.getElementById("reset-filters").addEventListener("click", resetFilters);
    }

    function applyFilters() {
        const selectedCountries = Array.from(
            document.querySelectorAll(".country-filter:checked")
        ).map(el => el.value);

        const selectedVersion = document.getElementById("filter-version").value;

        markers.clearLayers();

        const filtered = nodes.filter(n =>
            selectedCountries.includes(n.meta.country) &&
            (!selectedVersion || n.meta.version === selectedVersion)
        );

        filtered.forEach(n => markers.addLayer(n.marker));
        renderTable(filtered.map(n => n.meta));
    }

    function resetFilters() {
        document.querySelectorAll(".country-filter").forEach(el => el.checked = true);
        document.getElementById("filter-version").value = "";
        applyFilters();
    }

    // =======================================
    // Table
    // =======================================
    function renderTable(filtered = nodes.map(n => n.meta)) {
        const tbody = document.getElementById("node-table");
        tbody.innerHTML = filtered.map(n => `
            <tr>
                <td>${n.ip}</td>
                <td>${n.country}</td>
                <td>${n.version}</td>
            </tr>
        `).join("");
    }

});
