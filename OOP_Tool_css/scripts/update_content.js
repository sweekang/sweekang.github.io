// generates OOP code

function generate_init(attrs) {
    var init = "";
    init += `\tdef __init__(self, ${attrs.join(', ')}):\n`;
    init += "\t\t";
    init += attrs.map(attr => `self._${attr} = ${attr}`).join("\n\t\t");
    init += "\n\n";
    return init;
}

function generate_getter(attr) {
    var getter = "";

    getter += `\tdef get_${attr}(self):\n`;
    getter += `\t\treturn self._${attr}\n\n`;

    return getter;
}

function generate_setter(attr) {
    var setter = "";

    setter += `\tdef set_${attr}(self, new_${attr}):\n`;
    setter += `\t\tself._${attr} = new_${attr}\n\n`;

    return setter;
}

function generate(input) {

    var attrs = input.split(",") // split by commas
    attrs = attrs.map(attr => attr.trim()); // remove trailing spaces
    attrs = attrs.filter(attr => attr !== ''); // remove empty elements

    if ($(`#class_name_${curr_id}`).val() == "" || attrs.length == 0) {
        update_class_name(); // changes class name to 'class' if class name is empty
        return ""; // return nothing if class name is not defined or if no attributes are defined yet
    }

    var final = "";
    var get_attr = $(`#getters_${curr_id}`).is(":checked"); // check if user wants to generate getters
    var set_attr = $(`#setters_${curr_id}`).is(":checked"); // check if user wants to generate setters

    var class_name = $(`#class_name_${curr_id}`).val();
    var parent_class = $(`#parent_class_${curr_id}`).val();
    final += `class ${class_name}(${parent_class}):\n`;

    final += generate_init(attrs);

    for (let i = 0; i < attrs.length; i++) {
        if (get_attr) {final += generate_getter(attrs[i]);}
        if (set_attr) {final += generate_setter(attrs[i]);}
    }

    final += "\tdef __str__(self):\n";
    final += "\t\tresult = \"\"\n\n";
    final += "\t\treturn result\n"

    return final;
}

function update_content() {
    var content = generate($(`#attributes_${curr_id}`).val());
    $(`#content_${curr_id}`).text(content);
    hljs.highlightAll();
}

function update_all() {
    var all_classes = $("#page_list").children();
    var all_data = "";
    for (let i = 0; i < all_classes.length; i++) {
        all_data += $(`#content_${all_classes.eq(i).attr("class").split(' ')[0]}`).text();
        all_data += "\n";
    }
    $(`#content_all`).text(all_data);
    hljs.highlightAll();
}