function switch_page(new_page_class) {
    $(`.class_section.${curr_id}`).hide();
    $(`.class_section.${new_page_class}`).show();
    curr_id = new_page_class;
}