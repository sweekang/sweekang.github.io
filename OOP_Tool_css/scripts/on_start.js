var curr_id = "all";

$(document).ready(function() {
    $(`a.all`).on("click", function() {
        update_all();
        switch_page("all");
    });

    $(`.copy.all`).on("click", function(e) {
        e.stopPropagation();
        update_all();
        copy_to_clipboard("all");
    });

    $(`.download.all`).on("click", function(e) {
        e.stopPropagation();
        update_all();
        download("all_class.py", $(`#content_all`).text());
    });

    $('#class_all').hide();
        var new_id = generate_uid();
        generate_page(new_id);
        switch_page(new_id);

    $('.ui.sidebar').sidebar('setting', 'dimPage', false);

    curr_id = new_id;
});