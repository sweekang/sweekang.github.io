function generate_page(new_id) {
    var content = `
    <section id = "class_${new_id}" class = "class_section ${new_id}">
            <div>
                <div>
                    Class Name: <input type = "text" id = "class_name_${new_id}" class = "${new_id}"> <br/>
                    Parent Class (optional field): <input type = "text" id = "parent_class_${new_id}" class = "${new_id}"> <br/>
                    Attributes (comma seperated list): <input type = "text" id = "attributes_${new_id}" placeholder="attr1, attr2, attr3, ..." class = "${new_id}"> <br/>
                </div>

                <div>
                    <input type="checkbox" id="setters_${new_id}" name="setters_${new_id}" checked class = "${new_id}">
                    <label for="setters_${new_id}">Setters</label><br/>

                    <input type="checkbox" id="getters_${new_id}" name="getters_${new_id}" checked class = "${new_id}">
                    <label for="getters_${new_id}">Getters</label><br/>

                    <input type="checkbox" id="parent_${new_id}" name="parent_${new_id} class = "${new_id}">
                    <label for="parent_${new_id}">Parents</label><br/>
                </div>
            </div>

            <div>
                <textarea cols = 100 rows = 30 id = "content_${new_id}" class = "${new_id}"></textarea>
            </div>
        </section>
    `

    $("#container").append(content);

    // add evenet listener
    $(`#class_name_${new_id}`).on('input',function() {update_content();});
    $(`#class_name_${new_id}`).on('input',function() {update_class_name();});

    $(`#parent_class_${new_id}`).on('input',function() {update_content();});
    $(`#attributes_${new_id}`).on('input',function() {update_content();});
    $(`#setters_${new_id}`).change(function() {update_content();});
    $(`#getters_${new_id}`).change(function() {update_content();});

    var nav_ele = `
        <li class = "${new_id}"><span class = "${new_id}">
            <div id = "nav_class_name_${new_id}">Class</div>
            <div id = "copy_${new_id}" class = "${new_id}">Copy</div>
            <div id = "delete_${new_id}" class = "${new_id}">Delete</div>
        </span></li>`

    $(nav_ele).appendTo("#page_list");

    // event listener to switch page on click
    $(`span.${new_id}`).on("click", function() {switch_page($(this).attr("class"));});
    // event listener to copy page
    $(`#copy_${new_id}`).on("click", function(e) {
        e.stopPropagation();
        copy_to_clipboard($(this).attr("class"));
    });
    // event listener to delete page
    $(`#delete_${new_id}`).on("click", function(e) {
        e.stopPropagation();
        delete_page_confirm($(this).attr("class"));
    });
}

$(document).ready(function() {
    $("#add_page").on("click", function() {
        $(`#class_${curr_id}`).hide();
        var new_id = generate_uid();
        generate_page(new_id);

        curr_id = new_id;
    });
});