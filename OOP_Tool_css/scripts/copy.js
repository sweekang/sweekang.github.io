function copy_to_clipboard(class_name) {
    // Get the text field
    var copyText = $(`#content_${class_name}`).text();
  
    // Copy the text inside the text area
    navigator.clipboard.writeText(copyText);
}