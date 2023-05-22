function switch_page(new_page_class) {
    $(`.item.${curr_id}`).removeClass("active");
    $(`.class_section.${curr_id}`).hide();
    $(`.item.${new_page_class}`).addClass("active");
    $(`.class_section.${new_page_class}`).show();
    curr_id = new_page_class;
}