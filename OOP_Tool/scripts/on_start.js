var curr_id = "all";

$(document).ready(function() {
    $(`span.all`).on("click", function() {
        update_all();
        switch_page($(this).attr("class"));
    });

    $(`#copy_all`).on("click", function(e) {
        e.stopPropagation();
        update_all();
        copy_to_clipboard("all");
    });

    $(`#download_all`).on("click", function(e) {
        e.stopPropagation();
        update_all();
        download("all_class.py", $(`#content_all`).val());
    });

    $('#class_all').hide();
        var new_id = generate_uid();
        generate_page(new_id);

    curr_id = new_id;
});