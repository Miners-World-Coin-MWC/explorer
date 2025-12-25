// Display doc links
function displayDocs() {
    $('a.api-link').each(function() {
        docsLink = getApi()['api'] + docs[$(this).attr('data-docs-link')];
        $(this).attr('href', docsLink)
        $(this).text(docsLink)
    });
}