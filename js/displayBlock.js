// Latest blocks table rows
function displayBlocks(blocks, prepend = false) {
    $('#blocks-table tbody .skeleton-row').remove()
    var initial = $('#blocks-table tbody tr').length == 0

    blocks = prepend ? blocks.reverse() : blocks
    blocks.forEach(function(block) {
        if ($('tr[data-height="' + block.height + '"]').length == 0) {
            var hash = esc(block.hash)
            var content = `
                <tr data-height="${esc(block.height)}" class="${prepend && !initial ? 'row-new' : ''}">
                    <td><a class="height-link" href="#/block/${hash}">${fmtNum(block.height)}</a></td>
                    <td class="time-cell">
                        <span data-age="${esc(block.time)}">${timeAgo(block.time)}</span>
                        <small>${timeFormat(block.time)}</small>
                    </td>
                    <td class="hash-cell"><a href="#/block/${hash}" title="${hash}">${esc(shortHash(block.hash))}</a></td>
                    <td class="col-num"><span class="pill">${block.txcount != undefined ? esc(block.txcount) : '1'}</span></td>
                </tr>`

            if (prepend) {
                $('#blocks-table tbody').prepend(content)
            } else {
                $('#blocks-table tbody').append(content)
            }
        }

        if (block.height == 0) {
            $('#more').addClass('d-none')
        }
    })
}
