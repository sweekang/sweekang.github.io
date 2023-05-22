function generate_page(new_id) {
    var content = `
    <section id = "class_${new_id}" class = "class_section ${new_id}">
            <div class="ui inverted form">
                <div class = "equal width fields">
                    <div class="field">
                    <label>Class Name: </label>
                    <input type = "text" id = "class_name_${new_id}" class = "${new_id}"> <br/>
                    </div>

                    <div class="field">
                    <label>Parent Class (optional field): </label>
                    <input type = "text" id = "parent_class_${new_id}" class = "${new_id}"> <br/>
                    </div>

                    <div class="field">
                    <label>Attributes (comma seperated list): </label>
                    <input type = "text" id = "attributes_${new_id}" placeholder="attr1, attr2, attr3, ..." class = "${new_id}"> <br/>
                    </div>
                </div>

                <div>
                    <div class="inline fields">
                        <div class="field">
                        <div class = "ui checkbox">
                        <label>Setters </label>
                        <input type="checkbox" id="setters_${new_id}" name="setters_${new_id}" checked class = "${new_id}" tabindex = "0">
                        </div>
                        </div>

                        <div class="field">
                        <div class = "ui checkbox">
                        <label>Getters </label>
                        <input type="checkbox" id="getters_${new_id}" name="getters_${new_id}" checked class = "${new_id}" tabindex = "0">
                        </div>
                        </div>
                    </div>

                    <i class = "${new_id} copy outline icon copy_icon"></i>
                </div>
            </div>

            <div>
                <pre><code id = "content_${new_id}" class = "${new_id} language-python"></code></pre>
            </div>
        </section>
    `

    $("#container").append(content);
    $('.ui.checkbox').checkbox();
    hljs.highlightAll();

    // add evenet listener
    $(`#class_name_${new_id}`).on('input',function() {update_content();});
    $(`#class_name_${new_id}`).on('input',function() {update_class_name();});

    $(`#parent_class_${new_id}`).on('input',function() {update_content();});
    $(`#attributes_${new_id}`).on('input',function() {update_content();});
    $(`#setters_${new_id}`).change(function() {update_content();});
    $(`#getters_${new_id}`).change(function() {update_content();});

    var nav_ele = `
        <a class = "${new_id} item"><span class = "${new_id}">
            <div id = "nav_class_name_${new_id}" class = "class_name_nav">Class</div>
            <i id = "copy_${new_id}" class = "${new_id} copy outline icon copy_icon"></i>
            <i id = "delete_${new_id}" class = "${new_id} trash alternate outline icon del_icon"></i>
        </span></a>`

    $(nav_ele).appendTo("#page_list");

    // event listener to switch page on click
    $(`a.${new_id}`).on("click", function() {switch_page($(this).attr("class").split(' ')[0]);});
    // event listener to copy page
    $(`.copy_icon`).on("click", function(e) {
        e.stopPropagation();
        copy_to_clipboard($(this).attr("class").split(' ')[0]);
    });
    // event listener to delete page
    $(`#delete_${new_id}`).on("click", function(e) {
        e.stopPropagation();
        delete_page_confirm($(this).attr("class").split(' ')[0]);
    });
}

$(document).ready(function() {
    $("#add_page").on("click", function() {
        var new_id = generate_uid();
        generate_page(new_id);
        switch_page(new_id);
        curr_id = new_id;
    });
});