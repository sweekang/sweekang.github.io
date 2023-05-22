function download(filename, text) {
    var element = document.createElement('a');
    $(element).attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    $(element).attr('download', filename);
  
    $(element).hide();
    $("body").append($(element));
  
    element.click();
  
    $("body").remove(element);
}