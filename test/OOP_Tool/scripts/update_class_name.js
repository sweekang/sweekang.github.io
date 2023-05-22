function update_class_name() {
    var new_class_name = $(`#class_name_${curr_id}`).val();
    if (new_class_name == "") {$(`#nav_class_name_${curr_id}`).text("Class");}
    else {$(`#nav_class_name_${curr_id}`).text(new_class_name);}
}