// Display stuffs here~
function displayBlocks(blocks, prepend = false) {
    blocks = prepend ? blocks.reverse() : blocks
    blocks.forEach(function(block, index) {
        if ($('tr[data-height="' + block.height + '"]').length == 0) {
            var content = `
                <tr data-height="${block.height}">
                    <td>
                        <a href="#/block/${block.hash}">
                            ${block.height}
                        </a>
                    </td>
                    <td>
                        ${timeFormat(block.time)}
                    </td>
                    <td>
                        <a href="#/block/${block.hash}">
                            ${block.hash}
                        </a>
                    </td>
                    <td>
                        ${block.txcount != undefined ? block.txcount : '1'}
                    </td>
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
    });
}