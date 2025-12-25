function loadPeers() {
    fetch("http://api.minersworld.org:4321peers")
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById("peers-list");
            tbody.innerHTML = "";

            if (data.error) {
                tbody.innerHTML = `<tr><td colspan="4">Error loading peers</td></tr>`;
                return;
            }

            const peers = data.result;
            if (peers.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4">No peers connected.</td></tr>`;
                return;
            }

            // Process each peer
            peers.forEach(peer => {
                const row = document.createElement("tr");

                // Extract IP Address (handling both IPv4 and IPv6)
                const ip = peer.addr;
                let displayIp = ip;

                // If it's an IPv6 address, we extract the base address (IPv6 can include port info in brackets)
                if (ip.includes(":")) {
                    // Extract just the IPv6 address part, strip brackets if present
                    // For IPv6, ensure the entire address is displayed
                    displayIp = ip.startsWith("[") ? ip.slice(1, -1) : ip;
                }

                // Extract other peer information
                const subver = peer.subver || "N/A";
                const pingtime = parseFloat(peer.pingtime).toFixed(3);

                // Use GeoJS to get the location info for the IP address
                fetch(`https://get.geojs.io/v1/ip/geo/${ip}.json`)
                    .then(response => response.json())
                    .then(geoData => {
                        const country = geoData.country || "Unknown";
                        const countryCode = geoData.country_code || "US"; // Default to US if no country code found

                        // Function to get the actual flag image from the country code
                        const getFlagUrl = (countryCode) => {
                            return `https://flagcdn.com/w320/${countryCode.toLowerCase()}.png`;
                        };

                        const flagUrl = getFlagUrl(countryCode); // Get the flag image URL

                        // Fill the row with peer data
                        row.innerHTML = `
                            <td>${displayIp}</td>
                            <td>${subver}</td>
                            <td>${pingtime}</td>
                            <td><img src="${flagUrl}" alt="${country}" style="width: 20px; height: 15px; margin-right: 5px;"/> ${country}</td>
                        `;
                        tbody.appendChild(row);
                    })
                    .catch(err => {
                        // In case GeoJS fails, just show Unknown for location
                        const country = "Unknown";
                        row.innerHTML = `
                            <td>${displayIp}</td>
                            <td>${subver}</td>
                            <td>${pingtime}</td>
                            <td>${country}</td>
                        `;
                        tbody.appendChild(row);
                        console.error("GeoJS error:", err);
                    });
            });
        })
        .catch(err => {
            const tbody = document.getElementById("peers-list");
            tbody.innerHTML = `<tr><td colspan="4">Failed to load peers</td></tr>`;
            console.error("Peer fetch error:", err);
        });
}

// Load peers on home load
document.addEventListener("DOMContentLoaded", loadPeers);
