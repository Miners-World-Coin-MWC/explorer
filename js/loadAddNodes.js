// =======================================
// Network Configuration
// =======================================
const NETWORKS = {
    mainnet: {
        name: "Mainnet",
        endpoint: "https://api.minersworld.org/peers",
        confPrefix: ""
    },
    testnet: {
        name: "Testnet",
        endpoint: "https://api.minersworld.org/testnet/peers",
        confPrefix: "testnet=1\n"
    }
};

// =======================================
// UI Helpers
// =======================================
function createRow(ip, online, command) {
    const row = document.createElement("div");
    row.className = "addnode-row";

    const status = document.createElement("span");
    status.className = `addnode-status ${online ? "online" : "offline"}`;
    status.textContent = online ? "🟢" : "🔴";

    const cmd = document.createElement("span");
    cmd.className = "addnode-cmd";
    cmd.textContent = command;

    const copy = document.createElement("span");
    copy.className = "addnode-copy";
    copy.innerHTML = '<i class="fa fa-copy"></i>';
    copy.title = "Copy";
    copy.onclick = () => {
        navigator.clipboard.writeText(command);
        copy.innerHTML = "✓";
        setTimeout(() => {
            copy.innerHTML = '<i class="fa fa-copy"></i>';
        }, 1200);
    };

    row.appendChild(status);
    row.appendChild(cmd);
    row.appendChild(copy);

    return row;
}

// =======================================
// Normalize IPv4 / IPv6
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
function loadAddNodes(network = "mainnet") {
    const net = NETWORKS[network];
    if (!net) return;

    fetch(net.endpoint)
        .then(res => res.json())
        .then(data => {
            const cliBox = document.getElementById("cli-addnodes");
            const confBox = document.getElementById("conf-addnodes");

            cliBox.innerHTML = "";
            confBox.innerHTML = "";

            if (!data.result || data.result.length === 0) {
                cliBox.textContent = "No peers available.";
                confBox.textContent = "No peers available.";
                return;
            }

            const seen = new Set();

            data.result.forEach(peer => {
                const ip = normalizeIP(peer.addr);
                if (!ip || seen.has(ip)) return;
                seen.add(ip);

                const online = true;

                // CLI command
                cliBox.appendChild(
                    createRow(ip, online, `addnode "${ip}" add`)
                );

                // conf command
                confBox.appendChild(
                    createRow(
                        ip,
                        online,
                        `${net.confPrefix}addnode=${ip}`
                    )
                );
            });
        })
        .catch(err => {
            console.error("Failed to load peers:", err);
        });
}

// =======================================
// Auto Network Detection
// =======================================
document.addEventListener("DOMContentLoaded", () => {
    const isTestnet =
        location.search.includes("testnet") ||
        location.pathname.includes("testnet");

    loadAddNodes(isTestnet ? "testnet" : "mainnet");
});
