function delete_page_confirm(class_name) {
    var destination_tick = $(`#copy_${class_name}`).offset();
    var destination_cross = $(`#delete_${class_name}`).offset();

    var confirm = $(`<i id = "confirm_delete_${class_name}" class = "${class_name} check icon"></i>`);
    var cancel = $(`<i id = cancel_delete_${class_name} class = "${class_name} close icon"></i>`);

    $(`span.${class_name}`).append($(confirm));
    $(`span.${class_name}`).append($(cancel));


    $(`#confirm_delete_${class_name}`).css({top: destination_tick.top, left: destination_tick.left});
    $(`#cancel_delete_${class_name}`).css({top: destination_cross.top, left: destination_cross.left});

    $(confirm).show();
    $(cancel).show();

    $(`#copy_${class_name}`).hide();
    $(`#delete_${class_name}`).hide();

    $(confirm).on("click", function(e) {
        e.stopPropagation();
        delete_page(class_name);
    });

    $(cancel).on("click", function(e) {
        e.stopPropagation();
        $(`#copy_${class_name}`).show();
        $(`#delete_${class_name}`).show();
        $(confirm).remove();
        $(cancel).remove();
    });

    
    $(document).click(function(e) {
        if ((!$(confirm).is(e.target) && !$(confirm).has(e.target).length) && (!$(cancel).is(e.target) && !$(cancel).has(e.target).length)){
            $(`#copy_${class_name}`).show();
            $(`#delete_${class_name}`).show();
            $(confirm).remove();
            $(cancel).remove();
        }
    });
}

function delete_page(class_name) {
    $(`#class_${class_name}`).remove();
    $(`.${class_name}`).remove();

    if (class_name == curr_id) {
        var last_page = $('#page_list a:last-child').attr("class").split(' ')[0];
        switch_page(last_page);
    }
}