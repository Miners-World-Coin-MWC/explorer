function displayTransactions(holder, data, offset = 0) {
    var index = offset
    data.forEach(function(transaction) {
        var tx = esc(transaction)
        var content = `
            <div class="card tx-card mt-3" data-transaction="${tx}" data-transaction-index="${index}" data-transaction-loaded="false">
                <div class="card-header">
                    <i class="fa-solid fa-right-left text-muted"></i>
                    <a class="tx-hash" href="#/transaction/${tx}" title="${tx}">${esc(shortHash(transaction))}</a>
                    <span class="transaction-badge"><span class="badge d-none"></span></span>
                    <span class="transaction-fiat"></span>
                    <span class="transaction-time"></span>
                </div>
                <div class="card-body">
                    <div class="tx-cols">
                        <div class="tx-col transaction-from d-none">
                            <div class="tx-col-title">Inputs</div>
                            <ul class="list-group"></ul>
                        </div>
                        <div class="tx-col transaction-to d-none">
                            <div class="tx-col-title">Outputs</div>
                            <ul class="list-group"></ul>
                        </div>
                    </div>
                </div>
            </div>`
        holder.append(content)
        index += 1
    })

    loadTransactions(holder)
}
