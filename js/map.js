document.addEventListener("DOMContentLoaded", () => {
                    const map = L.map("node-map").setView([20, 0], 2);
                    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                        attribution: '© MinersWorldCoin contributors',
                        maxZoom: 18,
                    }).addTo(map);
                    const markers = L.markerClusterGroup();

                    const customIcon = L.icon({
                    iconUrl: '/img/favicon-32.png',       // Path to your logo
                    iconSize: [32, 32],        // Size of the icon
                    iconAnchor: [16, 32],      // Point of the icon which corresponds to marker's location
                    popupAnchor: [0, -32]      // Where the popup opens relative to the iconAnchor
                    });


                    const countryCounts = {};
                    const versions = new Set();
                    const nodes = [];

                    fetch("http://api.minersworld.org:4321peers")
                        .then(res => res.json())
                        .then(data => {
                            const peers = data.result || [];
                            const uniqueIPs = new Set();

                            peers.forEach(peer => {
                                let ip = peer.addr;
                                if (ip.startsWith("[") && ip.includes("]")) ip = ip.slice(1, ip.indexOf("]"));
                                else if (ip.includes(":")) ip = ip.split(":")[0];

                                if (!uniqueIPs.has(ip)) {
                                    uniqueIPs.add(ip);

                                    fetch(`https://get.geojs.io/v1/ip/geo/${ip}.json`)
                                        .then(r => r.json())
                                        .then(loc => {
                                            const country = loc.country || "Unknown";
                                            const version = peer.subver || "Unknown";


                                            countryCounts[country] = (countryCounts[country] || 0) + 1;
                                            versions.add(version);


                                            const marker = L.marker([loc.latitude, loc.longitude], { icon: customIcon })
                                                .bindPopup(`<b>${ip}</b><br>${loc.city}, ${loc.country}`);
                                            marker.meta = { ip, country, version };
                                            markers.addLayer(marker);

                                            nodes.push({ marker, meta: marker.meta });
                                            updateStats();
                                            updateFilters();
                                            renderTable();
                                        });
                                }
                            });

                            map.addLayer(markers);
                        });

                    function updateStats() {
                        document.getElementById("stat-nodes").textContent = nodes.length;
                        document.getElementById("stat-countries").textContent = Object.keys(countryCounts).length;
                        document.getElementById("stat-versions").textContent = versions.size;
                        document.getElementById("stat-time").textContent = new Date().toLocaleTimeString();
                    }

                    function updateFilters() {
                    const countryContainer = document.getElementById("country-checkboxes");
                    const versionSelect = document.getElementById("filter-version");

                    countryContainer.innerHTML = Object.keys(countryCounts)
                        .sort()
                        .map(c => `<div><input type="checkbox" class="country-filter" value="${c}" checked> ${c}</div>`)
                        .join("");

                    versionSelect.innerHTML = '<option value="">All Versions</option>' +
                        Array.from(versions).map(v => `<option value="${v}">${v}</option>`).join("");

                    countryContainer.querySelectorAll("input").forEach(input => {
                        input.addEventListener("change", applyFilters);
                    });
                    versionSelect.addEventListener("change", applyFilters);
                    document.getElementById("reset-filters").addEventListener("click", resetFilters);
                }


                    function applyFilters() {
                    const selectedCountries = Array.from(document.querySelectorAll(".country-filter:checked")).map(el => el.value);
                    const selectedVersion = document.getElementById("filter-version").value;

                    markers.clearLayers();

                    const filtered = nodes.filter(n => {
                        return selectedCountries.includes(n.meta.country) &&
                            (!selectedVersion || n.meta.version === selectedVersion);
                    });

                    filtered.forEach(n => markers.addLayer(n.marker));
                    renderTable(filtered.map(n => n.meta));
                }


                    function resetFilters() {
                        document.querySelectorAll(".country-filter").forEach(el => el.checked = true);
                        document.getElementById("filter-version").value = "";
                        applyFilters();
                    }

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