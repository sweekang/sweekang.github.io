var reset = false;
document.body.onkeyup = function(e) {
    // pause and play
    if (e.key == " " || e.code == "Space" || e.keyCode == 32) {
        document.getElementById('instructions').style.animation="disappear 1s ease-out forwards";
  
        run = !run;
        ease = 0;
  
        if (run) gui.close();
        else gui.open();
  
        for (let c in gui.controllersRecursive()) gui.controllersRecursive()[c].disable( run );
    }

    // reset
    if (e.key == "r" || e.code == "KeyR" || e.keyCode == 82) {
        for (let c in gui.controllersRecursive()) gui.controllersRecursive()[c].disable( run );

        if (reset) {
            i = 1
            for (let m of magnets) {
                window['folder'+m.id].destroy()
            }
            magnets = [
            new Magnet(width/2, 5*height/7, 5000, HSVtoRGB(random(), 1, 1)),
            new Magnet(width/3, 2*height/5, 5000, HSVtoRGB(random(), 1, 1)),
            new Magnet(2*width/3, 2*height/5, 5000, HSVtoRGB(random(), 1, 1))
            ]
        }
        equilibriumFound = false;
        bodies = [];
        reset = true;
        run = false;
        ease = 0;
        setup();
    }
    else {
        reset = false;
    }
}

// add new magnet
const cursor = document.getElementById('tempMagnet');
document.getElementById('addMagnet').addEventListener("click", function() {
    
    const controller = new AbortController();
    var clicks = 0

    //show position of magnet
    cursor.style.setProperty("visibility", "visible");
    document.body.addEventListener("mousemove", function(e) {
            cursor.style.left = e.clientX + "px";
            cursor.style.top = e.clientY + "px";
        }, 
        { signal: controller.signal }
    );

    document.body.addEventListener("click", function(e) {
        clicks++;
        if (clicks == 2 && e.pointerId != -1) { // pointerId == -1 could be space or enter key
            magnets.push(new Magnet((mouseX - controls.transform.dx)/controls.view.zoom, 
                                    (mouseY - controls.transform.dy)/controls.view.zoom, 
                                    5000, HSVtoRGB(random(), 1, 1)));
            
            cursor.style.setProperty("visibility", "hidden");
            controller.abort();
        }
    });

});