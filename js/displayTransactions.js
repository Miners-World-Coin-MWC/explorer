function displayTransactions(holder, data, offset = 0) {
    var index = offset
    data.forEach(function(transaction) {
        content = `
            <div class="card mt-3 light-shadow" data-transaction="${transaction}" data-transaction-index="${index}" data-transaction-loaded="false">
                <div class="card-header">
                    Transaction: <a href="#/transaction/${transaction}">
                        ${transaction}
                    </a>
                    <span class="transaction-badge">
                        <span class="ml-1 badge"></span>
                    </span>
                    <div class="float-right">
                        <span class="transaction-time"></span>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-12 transaction-from d-none">
                            <ul class="list-group mb-3">
                                <li class="list-group-item disabled">
                                    <b>Inputs</b>
                                </li>
                            </ul>
                        </div>
                        <div class="col-12 transaction-to d-none">
                            <ul class="list-group">
                                <li class="list-group-item disabled">
                                    <b>Outputs</b>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>`
        holder.append(content)
        index += 1
    })

    if (data.length > 0) {
        $('#more-block-transactions').removeClass('d-none')
    } else {
        $('#more-block-transactions').addClass('d-none')
    }

    loadTransactions(holder)
}