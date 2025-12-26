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
        setTimeout(() => (copy.innerHTML = '<i class="fa fa-copy"></i>'), 1200);
    };

    row.appendChild(status);
    row.appendChild(cmd);
    row.appendChild(copy);

    return row;
}

function normalizeIP(addr) {
    if (addr.startsWith("[")) {
        const end = addr.indexOf("]");
        return end !== -1 ? addr.substring(1, end) : addr;
    }
    if (addr.includes(":")) {
        const last = addr.lastIndexOf(":");
        const port = addr.substring(last + 1);
        if (!isNaN(parseInt(port))) return addr.substring(0, last);
    }
    return addr;
}

function loadAddNodes() {
    fetch("https://api.minersworld.org/peers") // temp endpoint
        .then(res => res.json())
        .then(data => {
            const cliBox = document.getElementById("cli-addnodes");
            const confBox = document.getElementById("conf-addnodes");

            cliBox.innerHTML = "";
            confBox.innerHTML = "";

            if (data.error || !data.result || data.result.length === 0) {
                cliBox.textContent = "No peers available.";
                confBox.textContent = "No peers available.";
                return;
            }

            const seen = new Set();

            data.result.forEach(peer => {
                const ip = normalizeIP(peer.addr);
                if (seen.has(ip)) return;
                seen.add(ip);

                const online = true; // peers endpoint = connected

                cliBox.appendChild(
                    createRow(ip, online, `addnode "${ip}" add`)
                );

                confBox.appendChild(
                    createRow(ip, online, `addnode=${ip}`)
                );
            });
        })
        .catch(err => {
            console.error(err);
        });
}

document.addEventListener("DOMContentLoaded", loadAddNodes);
