var hoveredMagnet = false;
const deleteMagnet = document.getElementById("deleteMagnet");

const controls = {
  view: {x: 0, y: 0, zoom: 1},
  transform: {dx: 0, dy: 0},
  viewPos: { prevX: null,  prevY: null,  isDragging: false },
}

window.mousePressed = e => Controls.move(controls).mousePressed(e);
window.mouseDragged = e => Controls.move(controls).mouseDragged(e);
window.mouseReleased = e => Controls.move(controls).mouseReleased(e);

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

class Controls {

  static move(controls) {

    function mousePressed(e) {
      if (mouseButton === LEFT) {
        hoveredMagnet = hoveredOnMagnet();
        controls.viewPos.isDragging = true;
        controls.viewPos.prevX = e.clientX;
        controls.viewPos.prevY = e.clientY;
        if (!deleteMagnet.matches(":hover")) deleteMagnet.style.setProperty("display", "none");
      }
      else if (mouseButton === RIGHT) {
        var selectedMagnet = hoveredOnMagnet();
        if (selectedMagnet) {
          deleteMagnet.style.setProperty("top", (selectedMagnet.pos.y-25)*controls.view.zoom+controls.transform.dy + "px");
          deleteMagnet.style.setProperty("left", (selectedMagnet.pos.x+10)*controls.view.zoom+controls.transform.dx + "px");
          deleteMagnet.style.setProperty("font-size", 14*controls.view.zoom + "px");
          deleteMagnet.style.setProperty("border-width", 1*controls.view.zoom + "px");
          deleteMagnet.style.setProperty("border-radius", 5*controls.view.zoom + "px");
          deleteMagnet.style.setProperty("padding-left", 5*controls.view.zoom + "px");
          deleteMagnet.style.setProperty("padding-right", 5*controls.view.zoom + "px");
          deleteMagnet.style.setProperty("display", "block");

          deleteMagnet.addEventListener("click", function() {
            deleteMagnet.style.setProperty("display", "none");
            magnets = magnets.filter((item) => {return item!=selectedMagnet;});
            window['folder'+selectedMagnet.id].destroy()
          });
        }
      }
    }

    function mouseDragged(e) {
      const {prevX, prevY, isDragging} = controls.viewPos;
      if(!isDragging) return;

      const pos = {x: e.clientX, y: e.clientY};
      const dx = pos.x - prevX;
      const dy = pos.y - prevY;
      
      // check if dragging window or dragging magnet
      if (hoveredMagnet && !run) {
        hoveredMagnet.pos.x += dx/controls.view.zoom;
        hoveredMagnet.pos.y += dy/controls.view.zoom;
      }
      else {
        if(prevX || prevY) {
          controls.view.x += dx;
          controls.view.y += dy;
        }
  
        controls.transform.dx += dx;
        controls.transform.dy += dy;
      }

      controls.viewPos.prevX = pos.x, controls.viewPos.prevY = pos.y;
    }

    function mouseReleased() {
      hoveredMagnet = false;
      controls.viewPos.isDragging = false;
      controls.viewPos.prevX = null;
      controls.viewPos.prevY = null;
    }

    return {
      mousePressed, 
      mouseDragged, 
      mouseReleased
    }
    
  }

  static zoom(controls) {

    function worldZoom(e) {
      if (controls.view.zoom > 0.3) {
        const {x, y, deltaY} = e;
        const direction = deltaY > 0 ? -1 : 1;
        const factor = 0.05;
        const zoom = 1 * direction * factor;
  
        const wx = (x-controls.view.x)/(width*controls.view.zoom);
        const wy = (y-controls.view.y)/(height*controls.view.zoom);
        
        controls.view.x -= wx*width*zoom;
        controls.view.y -= wy*height*zoom;
        controls.view.zoom += zoom;
  
        controls.transform.dx -= wx*width*zoom;
        controls.transform.dy -= wy*height*zoom;
      }
    }

    return {worldZoom}
  }
}