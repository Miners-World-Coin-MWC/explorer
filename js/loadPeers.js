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

// =======================================
// Normalize IP (IPv4 / IPv6 safe)
// =======================================
function normalizeIP(addr) {
    if (!addr) return "";

    // IPv6 [addr]:port
    if (addr.startsWith("[")) {
        const end = addr.indexOf("]");
        return end !== -1 ? addr.substring(1, end) : addr;
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
// Load Peers (Mainnet / Testnet)
// =======================================
function loadPeers(network = "mainnet") {
    const net = NETWORKS[network];
    if (!net) return;

    fetch(net.endpoint)
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById("peers-list");
            tbody.innerHTML = "";

            if (data.error || !data.result) {
                tbody.innerHTML = `<tr><td colspan="4">Error loading peers</td></tr>`;
                return;
            }

            const peers = data.result;
            if (peers.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4">No peers connected.</td></tr>`;
                return;
            }

            peers.forEach(peer => {
                const row = document.createElement("tr");

                const ipRaw = peer.addr || "";
                const displayIp = normalizeIP(ipRaw);

                const subver = peer.subver || "N/A";
                const pingtime = peer.pingtime
                    ? parseFloat(peer.pingtime).toFixed(3)
                    : "N/A";

                // GeoJS lookup (use normalized IP)
                fetch(`https://get.geojs.io/v1/ip/geo/${displayIp}.json`)
                    .then(res => res.json())
                    .then(geo => {
                        const country = geo.country || "Unknown";
                        const code = geo.country_code
                            ? geo.country_code.toLowerCase()
                            : null;

                        const flag = code
                            ? `<img src="https://flagcdn.com/w20/${code}.png"
                                   alt="${country}"
                                   style="width:20px;height:15px;margin-right:6px;">`
                            : "";

                        row.innerHTML = `
                            <td>${displayIp}</td>
                            <td>${subver}</td>
                            <td>${pingtime}</td>
                            <td>${flag}${country}</td>
                        `;
                        tbody.appendChild(row);
                    })
                    .catch(err => {
                        row.innerHTML = `
                            <td>${displayIp}</td>
                            <td>${subver}</td>
                            <td>${pingtime}</td>
                            <td>Unknown</td>
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

// =======================================
// Auto Network Detection
// =======================================
document.addEventListener("DOMContentLoaded", () => {
    const isTestnet =
        location.search.includes("testnet") ||
        location.pathname.includes("testnet");

    loadPeers(isTestnet ? "testnet" : "mainnet");
});
